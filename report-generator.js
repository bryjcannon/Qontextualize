import { OpenAI } from 'openai';
import { prompts } from './prompts.js';
import { extractClaims, verifyClaims, generateChunkSummaries, generateFinalSummary, determineClaimAgreement } from './video_claim_analysis.js';
import { claimSourceRunner } from './utils/sourceRunner.js';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateFinalReport(transcript) {
    try {
        // Extract & Identify claims
        console.log('Extracting claims...');
        const claims = await extractClaims(transcript);
        
        // Verify & Parse claims
        console.log('Verifying claims...');
        const verifiedClaims = await verifyClaims(claims);

        // Process claims for Source integration
        console.log('Processing claims with sources...');
        const processedClaims = await processClaimsWithSources(claims, verifiedClaims);

        return {
            videoTitle: 'Video Analysis',  // This will be set by the frontend
            summary,
            claims: processedClaims
        }
        
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
        };
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

export { generateFinalReport };
