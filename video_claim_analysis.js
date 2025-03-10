import OpenAI from 'openai';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
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
function chunkTranscript(transcript, options = {}) {
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

async function extractClaims(transcript) {
    const chunks = chunkTranscript(transcript);
    let allClaims = [];

    for (const chunk of chunks) {
        const prompt = prompts.extractClaims(chunk);
        
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ role: "user", content: prompt }]
        });
        
        const claims = response.choices[0].message.content;
        allClaims.push(claims);
    }

    // Combine and deduplicate claims
    const uniqueClaims = new Set(allClaims.join('\n').split('\n').filter(claim => claim.trim()));
    
    // Save claims summary
    try {
        await saveClaimsSummary(uniqueClaims);
    } catch (error) {
        console.error('Failed to save claims summary:', error);
    }
    
    return Array.from(uniqueClaims).join('\n');
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
                    model: "gpt-4o",
                    messages: [{ role: "user", content: prompt }]
                });
                
                let text = response.choices[0].message.content.trim();
                
                // Remove any markdown formatting or extra text
                if (text.includes('```')) {
                    // Extract content between JSON code blocks if present
                    const match = text.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
                    text = match ? match[1].trim() : text;
                }
                
                // Parse the cleaned JSON
                const analysis = JSON.parse(text);
                return { topic, analysis };
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

function extractTimestamps(transcript, claims) {
    const timestamps = {};
    
    claims.split('\n').forEach(claim => {
        const topic = claim.split(':')[0];
        timestamps[topic] = [];
        
        transcript.split('\n').forEach(line => {
            if (topic.toLowerCase().split(' ').some(word => line.toLowerCase().includes(word))) {
                const match = line.match(/\d{2}:\d{2}:\d{2}/);
                if (match) timestamps[topic].push(match[0]);
            }
        });
    });
    
    return timestamps;
}

async function fetchSourceLinks(query, domain) {
    console.log('🔎 Fetching sources for query:', { query, domain });
    
    try {
        // Use Google Custom Search API instead of web scraping
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_SEARCH_CX;
        
        console.log('🔑 API Key:', apiKey ? 'Set' : 'Not Set');
        console.log('🌐 Search Engine ID:', cx ? 'Set' : 'Not Set');
        
        if (!apiKey || !cx) {
            throw new Error('Google API credentials not found in environment variables');
        }
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}${domain ? `+site:${domain}` : ''}`;
        
        // Log URL with redacted credentials
        console.log('🌐 Making API request to:', searchUrl.replace(process.env.GOOGLE_API_KEY, '***').replace(process.env.GOOGLE_SEARCH_CX, '***'));
        
        const response = await fetch(searchUrl, {
            headers: {
                'Referer': 'chrome-extension://qontext.extension'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📊 Raw search results:', data);
        
        if (!data.items) {
            console.log('⚠️ No search results found');
            return [];
        }
        
        const trustedDomains = domain ? [domain] : ['cdc.gov', 'who.int', 'nejm.org', 'ncbi.nlm.nih.gov'];
        
        const links = data.items
            .filter(item => trustedDomains.some(d => item.link.includes(d)))
            .map(item => {
                // Extract metadata
                const metadata = item.pagemap || {};
                const metatags = metadata.metatags?.[0] || {};
                const citation = metadata.citation?.[0] || {};
                
                // Calculate relevance score
                const titleRelevance = calculateRelevance(query, item.title);
                const snippetRelevance = calculateRelevance(query, item.snippet || '');
                const dateBonus = metatags['article:published_time'] ? 0.2 : 0;
                const citationBonus = citation.author ? 0.3 : 0;
                const peerReviewedBonus = item.link.includes('pubmed') || item.link.includes('nejm.org') ? 0.3 : 0;
                
                const relevanceScore = Math.min(1, 
                    titleRelevance * 0.6 + 
                    snippetRelevance * 0.4 + 
                    dateBonus + 
                    citationBonus + 
                    peerReviewedBonus
                );
                
                return {
                    url: item.link,
                    title: item.title,
                    domain: domain || trustedDomains.find(d => item.link.includes(d)),
                    snippet: item.snippet,
                    publishedDate: metatags['article:published_time'] || citation.publicationDate,
                    authors: citation.author,
                    journal: citation.journal,
                    isPeerReviewed: item.link.includes('pubmed') || item.link.includes('nejm.org'),
                    relevanceScore
                };
            })
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
            
        console.log('📋 Processed links:', links);
        return links.slice(0, 3); // Return top 3 most relevant sources
    } catch (error) {
        console.error('❌ Error fetching source links:', error);
        return [];
    }
}

// Helper function to calculate text relevance
function calculateRelevance(query, text) {
    if (!text) return 0;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    // Calculate what percentage of query terms appear in the text
    const termMatches = queryTerms.filter(term => textLower.includes(term)).length;
    const termScore = termMatches / queryTerms.length;
    
    // Bonus for exact phrase match
    const phraseScore = textLower.includes(query.toLowerCase()) ? 0.3 : 0;
    
    // Bonus for scientific terms
    const scientificTerms = ['study', 'research', 'trial', 'analysis', 'evidence', 'data', 'findings'];
    const scientificScore = scientificTerms.some(term => textLower.includes(term)) ? 0.2 : 0;
    
    return Math.min(1, termScore + phraseScore + scientificScore);
}

async function fetchSources(claims) {
    const claimsList = claims.split('\n').filter(claim => claim.trim());
    const sources = {};

    // Process claims in parallel, but with rate limiting
    const BATCH_SIZE = 2; // Reduced batch size to avoid rate limiting
    for (let i = 0; i < claimsList.length; i += BATCH_SIZE) {
        const batch = claimsList.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async claim => {
            if (!claim.includes(':')) return null;

            const [topic, claimText] = claim.split(':', 2);
            console.log(`Fetching sources for claim: ${topic}`);

            try {
                // First try to find sources using the exact claim text
                const exactQuery = `"${claimText.trim()}" research evidence`;
                let foundSources = await searchAllDomains(exactQuery);

                // If no sources found, try with key terms from the claim
                if (foundSources.length === 0) {
                    // Extract key terms and create a more focused search query
                    const keyTerms = claimText
                        .toLowerCase()
                        .replace(/[^\w\s]/g, '')
                        .split(/\s+/)
                        .filter(word => word.length > 3 && !['this', 'that', 'than', 'what', 'when', 'where', 'which', 'while'].includes(word))
                        .slice(0, 5)
                        .join(' ');
                    
                    const broadQuery = `${keyTerms} ${topic} research evidence`;
                    foundSources = await searchAllDomains(broadQuery);
                }

                // If still no sources, try one last time with just the topic
                if (foundSources.length === 0) {
                    const topicQuery = `${topic} scientific evidence research`;
                    foundSources = await searchAllDomains(topicQuery);
                }

                sources[topic] = foundSources;
            } catch (error) {
                console.error(`Error fetching sources for '${topic}':`, error);
                sources[topic] = [];
            }
        });

        await Promise.all(batchPromises);

        // Add delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < claimsList.length) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    return sources;
}

async function searchAllDomains(query) {
    console.log('🔍 Starting source search for query:', query);
    
    // Define domains with specific search modifiers and weights
    const domains = [
        { domain: 'ncbi.nlm.nih.gov', modifier: 'scientific research study', weight: 4 },
        { domain: 'cdc.gov', modifier: 'guidelines evidence', weight: 3 },
        { domain: 'who.int', modifier: 'health research', weight: 3 },
        { domain: 'nejm.org', modifier: 'medical study', weight: 4 }
    ];

    // Try each domain to gather sources
    const uniqueSources = new Map();
    
    for (const { domain, modifier, weight } of domains) {
        console.log(`🌐 Searching domain: ${domain}`);
        const searchQuery = `${query} ${modifier}`;
        
        try {
            const results = await fetchSourceLinks(searchQuery, domain);
            
            // Add domain-specific weight to results
            const weightedResults = results.map(source => ({
                ...source,
                weight,
                domainScore: weight * (results.indexOf(source) === 0 ? 1.2 : 1) // Boost first result slightly
            }));
            
            weightedResults.forEach(source => {
                if (!uniqueSources.has(source.url)) {
                    uniqueSources.set(source.url, source);
                }
            });
        } catch (error) {
            console.error(`❌ Error searching ${domain}:`, error);
        }
        
        // Add a small delay between domain searches
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Sort sources by weight and domain score
    const finalSources = Array.from(uniqueSources.values())
        .sort((a, b) => b.domainScore - a.domainScore)
        .slice(0, 5) // Limit to top 5 sources
        .map(({ url, title, domain }) => ({ url, title, domain })); // Remove internal scoring

    console.log(`🏁 Search complete. Selected ${finalSources.length} top sources`);
    return finalSources;
}



export {
    extractClaims,
    verifyClaims,
    extractTimestamps,
    fetchSources,
    fetchSourceLinks
};
