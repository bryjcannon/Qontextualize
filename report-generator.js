import { OpenAI } from 'openai';
import { prompts } from './prompts.js';
import { extractClaims, verifyClaims, extractTimestamps, fetchSources, generateChunkSummaries, generateFinalSummary } from './video_claim_analysis.js';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateFinalReport(transcript) {
    try {
        console.log('Extracting claims...');
        const claims = await extractClaims(transcript);
        
        console.log('Verifying claims...');
        const verifiedClaims = await verifyClaims(claims);
        
        // Generate summaries first since we want them regardless of claims
        const chunkSummaries = await generateChunkSummaries(transcript);
        const summary = await generateFinalSummary(chunkSummaries);

        // If no claims were found or verified, return early with just the summary
        if (!verifiedClaims || verifiedClaims.length === 0) {
            return {
                summary,
                claims: [],
                message: "No strong or potentially controversial claims were identified in this video."
            };
        }
        
        console.log('Finding timestamps...');
        const timestamps = extractTimestamps(transcript, claims);
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

export { generateFinalReport };
