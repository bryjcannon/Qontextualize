import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import Sentiment from 'sentiment';
import { prompts } from '../prompts/prompts.js';
import { config } from '../config/index.js';
import openaiService from './openai-service.js';
import transcriptProcessor from './transcript-processor.js';

import { saveClaimsSummary } from '../utils/claims_record.js';

import { processClaims } from '../utils/claims_processor.js';

/**
 * Extract claims from transcript chunks.
 * @param {string[]} chunks - Array of transcript chunks
 * @returns {Promise<string>} Processed claims joined by newlines
 */
async function extractClaims(chunks) {
    let allClaims = [];

    // Extract initial claims from chunks
    for (const chunk of chunks) {
        const claims = await openaiService.extractClaims(chunk);
        allClaims.push(...claims);
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

    // Create array of promises for each claim verification
    const verificationPromises = claimsList
        .filter(claim => claim.includes(':'))
        .map(async claim => {
            const [topic, claimText] = claim.split(':', 2);
            const analysis = await openaiService.verifyClaim(claim, topic);
            return { topic, analysis };
        });

    // Wait for all verifications to complete
    const results = await Promise.all(verificationPromises);
    
    // Convert results array to object
    results.forEach(({ topic, analysis }) => {
        verifications[topic] = analysis;
    });

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
    console.log('Generating summaries for each chunk...');
    
    const chunkSummaries = await Promise.all(chunks.map(async (chunk, index) => {
        console.log(`Processing chunk ${index + 1}/${chunks.length}...`);
        const summaryPrompt = prompts.generateSummary(chunk);
        return await openaiService.analyzeContent(summaryPrompt);
    }));

    return chunkSummaries;
}

/**
 * Generates a final summary from individual chunk summaries.
 * @param {string[]} chunkSummaries - Array of summaries from each transcript chunk
 * @returns {Promise<string>} Final comprehensive summary
 */
async function generateFinalSummary(chunkSummaries) {
    console.log('Generating final summary...');
    const finalSummaryPrompt = prompts.generateFinalSummary(chunkSummaries.join('\n\n'));
    return await openaiService.analyzeContent(finalSummaryPrompt);
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
        const prompt = prompts.getSources(claim);

        const result = await openaiService.analyzeContent(prompt, { jsonResponse: true });
        
        if (!result.sources || !Array.isArray(result.sources)) {
            console.warn('No valid sources returned for claim:', claim);
            return [];
        }

        // Filter out invalid sources and normalize data
        const validSources = result.sources
            .filter(source => source && source.title && source.url)
            .map(source => ({
                title: source.title,
                summary: source.summary || '',
                stance: source.stance || 'neutral',
                url: source.url,
                // Optional metadata
                authors: source.authors || '',
                journal: source.journal || '',
                year: source.year || '',
                citations: source.citations || 0,
                domain: new URL(source.url).hostname.replace(/^www\./, '')
            }));

        console.log(`📚 Found ${validSources.length} valid sources for claim`);
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
    try {
        // Step 1: Break transcript into chunks
        console.log('Breaking transcript into chunks...');
        const chunks = transcriptProcessor.chunkTranscript(transcript);
        
        // Step 2: Extract claims from the chunks
        console.log('Extracting claims from transcript...');
        const claims = await extractClaims(chunks);
        
        // Step 3: Generate summaries for each chunk
        console.log('Generating chunk summaries...');
        const chunkSummaries = await generateChunkSummaries(chunks);
        
        // Step 4: Generate final summary from chunk summaries
        console.log('Generating final summary...');
        const finalSummaryResponse = await generateFinalSummary(chunkSummaries);
        
        return {
            claims,
            finalSummaryResponse,
            chunks,  // Including chunks in case needed downstream
            chunkSummaries  // Including chunk summaries in case needed downstream
        };
    } catch (error) {
        console.error('Error processing transcript:', error);
        throw error;
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
