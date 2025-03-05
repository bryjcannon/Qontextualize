import OpenAI from 'openai';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { prompts } from './prompts.js';

import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function chunkTranscript(transcript, maxChunkSize = 10000) {
    // Split transcript into sentences
    const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += sentence + ' ';
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

async function extractClaims(transcript) {
    const chunks = chunkTranscript(transcript);
    let allClaims = [];

    for (const chunk of chunks) {
        const prompt = prompts.extractClaims(chunk);
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }]
        });
        
        const claims = response.choices[0].message.content;
        allClaims.push(claims);
    }

    // Combine and deduplicate claims
    const uniqueClaims = new Set(allClaims.join('\n').split('\n').filter(claim => claim.trim()));
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

async function fetchSourceLinks(query) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)} site:cdc.gov OR site:who.int OR site:epa.gov OR site:nejm.org OR site:ncbi.nlm.nih.gov`;
    const headers = { "User-Agent": "Mozilla/5.0" };
    
    const response = await fetch(searchUrl, { headers });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const links = [];
    $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith("http") && !href.includes("google")) {
            links.push(href);
        }
    });
    
    return links.slice(0, 3);
}

async function generateFinalReport(transcript) {
    try {
        console.log('Extracting claims...');
        const claims = await extractClaims(transcript);
        
        console.log('Verifying claims...');
        const verifiedClaims = await verifyClaims(claims);
        
        console.log('Finding timestamps...');
        const timestamps = extractTimestamps(transcript, claims);
        
        const claimsList = claims.split('\n').filter(claim => claim.trim());
        let processedClaims = [];
        
        // Generate a summary of the video and its claims
        const summaryPrompt = prompts.generateSummary(transcript);
        const summaryResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: summaryPrompt }]
        });
        const summary = summaryResponse.choices[0].message.content;
        
        // Process all claims in parallel
        const claimPromises = claimsList
            .filter(claim => claim.includes(':'))
            .map(async claim => {
                const [topic, claimText] = claim.split(':', 2);
                console.log(`Processing claim: ${topic}`);
                
                try {
                    // Fetch sources and get verification in parallel
                    const [sources, verification] = await Promise.all([
                        fetchSourceLinks(topic),
                        verifiedClaims[topic] || {
                            confidence: 'Low',
                            assessment: 'Could not verify this claim',
                            evidence: [],
                            consensus: 'Insufficient data to establish scientific consensus'
                        }
                    ]);

                    // Get scientific consensus if not present
                    if (!verification.consensus) {
                        const consensusPrompt = prompts.getConsensus(topic, claimText);
                        const consensusResponse = await openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [{ role: "user", content: consensusPrompt }]
                        });
                        verification.consensus = consensusResponse.choices[0].message.content;
                    }

                    return {
                        title: topic,
                        summary: claimText.trim(),
                        timestamps: timestamps[topic] || [],
                        sources: sources.map(url => ({ url })),
                        consensus: verification.consensus,
                        assessment: verification.assessment
                    };
                } catch (error) {
                    console.error(`Error processing claim '${topic}':`, error);
                    return {
                        title: topic,
                        summary: claimText.trim(),
                        timestamps: timestamps[topic] || [],
                        sources: [],
                        consensus: 'Error: Could not verify scientific consensus',
                        assessment: 'Error: Could not fully analyze this claim'
                    };
                }
            });

        // Wait for all claims to be processed
        processedClaims = await Promise.all(claimPromises);  
        
        return {
            videoTitle: 'Video Analysis',  // This will be set by the frontend
            summary,
            claims: processedClaims
        };
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

export { generateFinalReport };
