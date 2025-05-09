import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import Sentiment from 'sentiment';
import { prompts } from '../prompts/prompts.js';
import { config } from '../config/index.js';
import openaiService from './openai-service.js';
import transcriptProcessor from './transcript-processor.js';
import timer from '../utils/timing.js';
import { processBatches, processSequentially, collectResults } from '../utils/batch-processor.js';
import { sanitizeUrl, extractDomain } from '../utils/url-security.js';
import { apiStats } from '../utils/api-stats.js';
import { saveProcessingStats } from '../utils/stats-recorder.js';

import { saveClaimsSummary } from '../utils/claims_record.js';
import { processClaims } from '../utils/claims_processor.js';

/**
 * Extract claims from transcript chunks.
 * @param {string[]} chunks - Array of transcript chunks
 * @returns {Promise<string>} Processed claims joined by newlines
 */
async function extractClaims(chunks) {
    // Extract claims from chunks in parallel batches
    const allClaims = [];
    const claimExtractor = async (chunk) => {
        return await openaiService.extractClaims(chunk);
    };

    for await (const batchClaims of processBatches(chunks, claimExtractor, {
        batchSize: 3,
        operationName: 'Extract claims from chunk',
        metadata: { totalChunks: chunks.length }
    })) {
        allClaims.push(...batchClaims.flat());
    }

    // Process claims through the pipeline
    console.log('Processing claims through reduction pipeline...');
    const processedResults = await processClaims(allClaims);
    
    // Check if full report is enabled from environment variable
    const fullReportEnabled = process.env.FULL_REPORT === 'true';
    
    // Select claims to process
    const claimsToProcess = fullReportEnabled
        ? processedResults.claims
        : processedResults.claims.slice(0, 10);
    
    console.log(`Processing ${claimsToProcess.length} claims (${fullReportEnabled ? 'full report' : 'top 10'})...`);
    
    // Save claims summary with processing metadata
    try {
        await saveClaimsSummary(new Set(claimsToProcess), {
            processingMetadata: {
                originalCount: processedResults.originalCount,
                filteredCount: processedResults.filteredCount,
                uniqueCount: processedResults.uniqueCount,
                finalCount: claimsToProcess.length,
                scores: processedResults.scores,
                fullReport: fullReportEnabled
            }
        });
    } catch (error) {
        console.error('Failed to save claims summary:', error);
    }
    
    return claimsToProcess.join('\n');
}

async function verifyClaims(claims) {
    const claimsList = claims.split('\n').filter(claim => claim.trim());
    const verifications = {};
    
    const verifier = async (claim) => {
        if (!claim.includes(':')) return null;
        const [topic, claimText] = claim.split(':', 2);
        const analysis = await openaiService.verifyClaim(claim, topic);
        return { topic, analysis };
    };

    // Process claims in batches
    for await (const batchResults of processBatches(claimsList, verifier, {
        batchSize: 3,
        operationName: 'Verify claims batch',
        metadata: { totalClaims: claimsList.length }
    })) {
        for (const result of batchResults) {
            if (result) {
                verifications[result.topic] = result.analysis;
            }
        }
    }
    
    return verifications;
}

const sentiment = new Sentiment();

function determineClaimAgreement(verification) {
    if (!verification) return 'Neutral';
    
    // Use the sentiment directly from the verification object
    if (verification.sentiment === 'Support' || verification.sentiment === 'Oppose' || verification.sentiment === 'Neutral') {
        return verification.sentiment;
    }
    
    // Fallback to Neutral if sentiment is not valid
    return 'Neutral';
}

/**
 * Generates summaries for each chunk of a transcript using GPT-4.
 * @param {string} transcript - The full transcript text
 * @returns {Promise<string[]>} Array of summaries for each chunk
 */
/**
 * Generates summaries for each chunk of a transcript using GPT-4.
 * @param {string[]} chunks - Array of transcript chunks
 * @returns {Promise<string[]>} Array of summaries for each chunk
 */
async function generateChunkSummaries(chunks) {
    const summaryGenerator = async (chunk) => {
        const summaryPrompt = prompts.generateSummary(chunk);
        return await openaiService.analyzeContent(summaryPrompt);
    };

    return await collectResults(processBatches(chunks, summaryGenerator, {
        batchSize: 2,
        operationName: 'Generate chunk summary',
        metadata: { totalChunks: chunks.length }
    }));
}

/**
 * Generates a final summary from individual chunk summaries.
 * @param {string[]} chunkSummaries - Array of summaries from each transcript chunk
 * @returns {Promise<string>} Final comprehensive summary
 */
async function generateFinalSummary(chunkSummaries) {
    return await timer.time(
        'Generate final summary',
        async () => {
            const finalSummaryPrompt = prompts.generateFinalSummary(chunkSummaries.join('\n\n'));
            return await openaiService.analyzeContent(finalSummaryPrompt);
        },
        { summaryCount: chunkSummaries.length }
    );
}

/**
 * Fetches scientific sources for a given claim using GPT-4.
 * @param {string} claim - The claim to find sources for
 * @returns {Promise<Array>} Array of source objects with metadata
 */
async function fetchSources(claim) {
    if (!claim || typeof claim !== 'string') {
        console.error('Invalid claim provided to fetchSources:', claim);
        return [];
    }

    try {
        console.log(`🔍 Fetching sources for claim: ${claim}`);
        const startTime = Date.now();
        const prompt = prompts.getSources(claim);

        // Track API usage for source fetching
        const result = await openaiService.analyzeContent(prompt, { jsonResponse: true });
        const cost = openaiService.calculateCost(openaiService.defaultModel, prompt.length, JSON.stringify(result).length);
        apiStats.recordCall('fetchSources', JSON.stringify(result).length, cost);
        
        if (!result.sources || !Array.isArray(result.sources)) {
            console.warn('No valid sources returned for claim:', claim);
            return [];
        }

        // Filter out invalid sources and normalize data
        const validSources = result.sources
            .filter(source => source && source.title && source.url)
            .map(source => {
                // Validate and sanitize URL
                const sanitizedUrl = sanitizeUrl(source.url, {
                    requireHttps: true,
                    allowedDomainsOnly: true
                });
                
                if (!sanitizedUrl) {
                    console.warn(`Skipping source with invalid URL: ${source.url}`);
                    return null;
                }

                const domain = extractDomain(sanitizedUrl);
                if (!domain) {
                    console.warn(`Could not extract domain from URL: ${sanitizedUrl}`);
                    return null;
                }

                return {
                    title: source.title,
                    summary: source.summary || '',
                    stance: source.stance || 'neutral',
                    url: sanitizedUrl,
                    // Optional metadata
                    authors: source.authors || '',
                    journal: source.journal || '',
                    year: source.year || '',
                    citations: source.citations || 0,
                    domain,
                    // Add source quality metrics
                    isPeerReviewed: Boolean(source.journal),
                    publishedDate: source.year ? `${source.year}-01-01` : null
                };
            })
            .filter(Boolean); // Remove null entries

        // Get source fetching stats
        const stats = apiStats.stats.callsByFunction['fetchSources'] || { calls: 0, tokens: 0, cost: 0 };
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Log detailed source fetching metrics
        console.log('\n=== Source Fetching Metrics ===');
        console.log(`📊 Found ${validSources.length} valid sources`);
        console.log(`⚡ Processing time: ${processingTime}s`);
        console.log(`🔄 API calls made: ${stats.calls}`);
        console.log(`📝 Total tokens used: ${stats.tokens}`);
        console.log(`💰 Total cost: $${stats.cost.toFixed(4)}`);
        console.log('============================\n');

        return validSources;

    } catch (error) {
        console.error('Error fetching sources:', error);
        return [];
    }
}

/**
 * Process a transcript through the complete analysis pipeline.
 * This function orchestrates the chunking, claim extraction, and summary generation.
 * 
 * @param {Object} transcript - The transcript object to process
 * @returns {Promise<Object>} Object containing claims and final summary
 */
async function processTranscript(transcript) {
    timer.start('Total processing time');
    apiStats.reset(); // Reset API stats at start
    
    try {
        // Step 1: Break transcript into chunks
        const chunks = await timer.time(
            'Chunk transcript',
            () => transcriptProcessor.chunkTranscript(transcript),
            { transcriptLength: transcript.length }
        );
        
        // Step 2: Extract claims from the chunks
        const claims = await timer.time(
            'Extract and process claims',
            () => extractClaims(chunks),
            { chunkCount: chunks.length }
        );
        
        // Step 3: Generate summaries and final summary
        const chunkSummaries = await timer.time(
            'Generate chunk summaries',
            () => generateChunkSummaries(chunks),
            { chunkCount: chunks.length }
        );

        const finalSummaryResponse = await timer.time(
            'Generate final summary',
            () => generateFinalSummary(chunkSummaries),
            { summaryCount: chunkSummaries.length }
        );
        
        // Get API usage stats
        apiStats.endSession();
        const apiReport = apiStats.getReport();
        console.log('\nAPI Usage Report:', apiReport);
        
        const totalTime = timer.end('Total processing time', {
            chunkCount: chunks.length,
            claimsCount: claims.length,
            summaryCount: chunkSummaries.length
        });
        
        // Prepare stats for saving
        const stats = {
            apiUsage: apiStats.stats,
            processingTime: totalTime,
            metadata: {
                chunkCount: chunks.length,
                claimsCount: claims.length,
                summaryCount: chunkSummaries.length
            }
        };
        
        // Save processing stats
        await saveProcessingStats(stats);
        
        return {
            claims,
            finalSummaryResponse,
            chunks,
            chunkSummaries,
            processingTime: totalTime,
            apiUsage: apiStats.stats // Include raw stats for analysis
        };
    } catch (error) {
        timer.end('Total processing time');
        console.error('Error processing transcript:', error);
        throw error;
    } finally {
        // Always end the API stats session
        apiStats.endSession();
    }
}

export {
    extractClaims,
    verifyClaims,
    determineClaimAgreement,
    processTranscript,
    generateChunkSummaries,
    generateFinalSummary,
    fetchSources
};
