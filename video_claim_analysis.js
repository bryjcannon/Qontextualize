import OpenAI from 'openai';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import Sentiment from 'sentiment';
import { prompts } from './prompts.js';
import config from './config.server.js';

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Estimates the number of tokens in a text string.
 * This is a rough estimate based on GPT tokenization patterns.
 * @param {string} text - The text to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokenCount(text) {
    // GPT models typically tokenize on word boundaries and common subwords
    // A rough estimate is 4 characters per token on average
    const charCount = text.length;
    return Math.ceil(charCount / 4);
}

/**
 * Splits transcript into overlapping chunks optimized for GPT-4-Turbo.
 * @param {string} transcript - The full transcript text
 * @param {Object} options - Chunking options
 * @param {number} options.maxTokens - Maximum tokens per chunk (default 10000)
 * @param {number} options.overlapTokens - Number of tokens to overlap (default 200)
 * @returns {string[]} Array of transcript chunks
 */
export function chunkTranscript(transcript, options = {}) {
    const {
        maxTokens = 10000,      // Target ~10K tokens per chunk
        overlapTokens = 200     // Overlap by ~200 tokens
    } = options;

    // Convert token counts to approximate character lengths
    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;

    // Split transcript into sentences
    const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
    const chunks = [];
    let currentChunk = '';
    let overlapSegment = '';

    for (const sentence of sentences) {
        // Add new sentence to the current chunk
        const newChunk = currentChunk + sentence + ' ';
        
        if (estimateTokenCount(newChunk) > maxTokens && currentChunk.length > 0) {
            // Store the current chunk
            chunks.push(currentChunk.trim());
            
            // Get the overlap segment from the end of the current chunk
            const words = currentChunk.split(' ');
            overlapSegment = words
                .slice(Math.max(0, words.length - overlapTokens))
                .join(' ');
            
            // Start new chunk with overlap
            currentChunk = overlapSegment + ' ' + sentence + ' ';
        } else {
            currentChunk = newChunk;
        }
    }

    // Add the final chunk if not empty
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    // Log chunking statistics
    console.log(`Split transcript into ${chunks.length} chunks:`);
    chunks.forEach((chunk, i) => {
        const tokenCount = estimateTokenCount(chunk);
        console.log(`Chunk ${i + 1}: ~${tokenCount} tokens`);
    });

    return chunks;
}

import { saveClaimsSummary } from './utils/claims_record.js';

import { processClaims } from './utils/claims_processor.js';

async function extractClaims(transcript) {
    const chunks = chunkTranscript(transcript);
    let allClaims = [];

    // Extract initial claims from chunks
    for (const chunk of chunks) {
        const prompt = prompts.extractClaims(chunk);
        
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ role: "user", content: prompt }]
        });
        
        const claims = response.choices[0].message.content;
        allClaims.push(...claims.split('\n').filter(claim => claim.trim()));
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
    let verifications = {};

    // Create array of promises for each claim verification
    const verificationPromises = claimsList
        .filter(claim => claim.includes(':'))
        .map(async claim => {
            const [topic, claimText] = claim.split(':', 2);
            
            const prompt = prompts.verifyClaim(claim, topic);
            
            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-4-turbo-preview",
                    messages: [{ 
                        role: "system", 
                        content: "You are a scientific fact-checker. Always respond with valid JSON matching the exact schema requested."
                    }, { 
                        role: "user", 
                        content: prompt 
                    }],
                    response_format: { type: "json_object" }
                });
                
                let text = response.choices[0].message.content.trim();
                
                try {
                    // Parse the JSON response
                    const analysis = JSON.parse(text);
                    
                    // Validate required fields
                    if (!analysis.topic || !analysis.confidence || !analysis.assessment || !analysis.evidence || !analysis.consensus) {
                        throw new Error('Missing required fields in JSON response');
                    }
                    
                    return { topic, analysis };
                } catch (parseError) {
                    console.error(`JSON parsing error for claim '${topic}':`, parseError);
                    console.error('Raw response:', text);
                    
                    // Return a structured error response
                    return {
                        topic,
                        analysis: {
                            topic,
                            confidence: 'Low',
                            assessment: 'Error parsing verification response',
                            evidence: [],
                            consensus: 'Unable to verify due to technical error'
                        }
                    };
                }
            } catch (error) {
                console.error(`Error verifying claim '${topic}':`, error);
                return {
                    topic,
                    analysis: {
                        topic,
                        confidence: 'Low',
                        assessment: 'Could not verify this claim',
                        evidence: [],
                        consensus: 'Insufficient data to establish scientific consensus'
                    }
                };
            }
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

function determineClaimAgreement(text) {
    if (!text) return 'Neutral';
    
    const negativeKeywords = [
        'incorrect', 'misleading', 'unverified', 'false', 'not supported', 'unsupported',
        'inaccurate', 'contrary', 'refuted', 'no evidence', 'lacks evidence', 'no link',
        'no scientific', 'no credible', 'no empirical', 'does not support', 'not supported',
        'disputed', 'unproven', 'debunked', 'flawed', 'unreliable', 'questionable',
        'insufficient', 'no proof', 'no data', 'no research', 'no studies', 'no correlation',
        'no causal', 'no relationship', 'no association', 'not established', 'not proven'
    ];

    const options = {
        extras: {
            // Strong negative indicators
            'unsupported': -4,
            'refuted': -5,
            'inaccurate': -4,
            'misleading': -4,
            'incorrect': -4,
            'false': -4,
            'contrary': -3,
            'unverified': -3,
            'disputed': -3,
            'debunked': -5,
            'flawed': -4,
            'unreliable': -3,
            'insufficient': -3,
            // Phrases indicating lack of evidence
            'no evidence': -5,
            'lacks evidence': -4,
            'no scientific': -4,
            'no credible': -4,
            'no empirical': -4,
            'not supported': -4,
            'no proof': -4,
            'no data': -4,
            'no research': -4,
            'no studies': -4,
            // Positive indicators (kept lower to bias towards opposition)
            'validated': 2,
            'confirmed': 2,
            'proven': 2,
            'established': 2,
            'supported': 2,
            'demonstrates': 2,
            'shows': 1,
            'indicates': 1
        }
    };

    const textLower = text.toLowerCase();
    const containsNegative = negativeKeywords.some(keyword => textLower.includes(keyword));
    const sentimentResult = sentiment.analyze(text, options);

    // More aggressive thresholds
    if (containsNegative || sentimentResult.score <= 0) {  // Changed from < 0 to <= 0
        return 'Oppose';
    } else if (sentimentResult.score > 2) {  // Require stronger positive sentiment
        return 'Support';
    }

    return 'Neutral';
}

/**
 * Generates summaries for each chunk of a transcript using GPT-4.
 * @param {string} transcript - The full transcript text
 * @returns {Promise<string[]>} Array of summaries for each chunk
 */
async function generateChunkSummaries(transcript) {
    const chunks = chunkTranscript(transcript);
    console.log('Generating summaries for each chunk...');
    
    const chunkSummaries = await Promise.all(chunks.map(async (chunk, index) => {
        console.log(`Processing chunk ${index + 1}/${chunks.length}...`);
        const summaryPrompt = prompts.generateSummary(chunk);
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ role: "user", content: summaryPrompt }]
        });
        return response.choices[0].message.content;
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
    const finalSummaryResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: finalSummaryPrompt }]
    });
    return finalSummaryResponse.choices[0].message.content;
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

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ 
                role: "system", 
                content: "You are a scientific research assistant. Always respond with valid JSON matching the exact schema requested."
            }, { 
                role: "user", 
                content: prompt 
            }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        
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

export {
    extractClaims,
    verifyClaims,
    determineClaimAgreement,
    generateChunkSummaries,
    generateFinalSummary,
    fetchSources
};
