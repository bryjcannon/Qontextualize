import { OpenAI } from 'openai';
import { prompts } from './prompts.js';
import { verifyClaims, generateFinalSummary, determineClaimAgreement, chunkTranscript } from './video_claim_analysis.js';
import { processClaims } from './utils/claims_processor.js';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateFinalReport(transcript) {
    try {
        // Process transcript chunks once for both claims and summaries
        console.log('Processing transcript chunks...');
        const chunks = chunkTranscript(transcript);
        
        // Extract claims and generate summaries in parallel
        const [claims, summaries] = await Promise.all([
            // Extract claims
            (async () => {
                let allClaims = [];
                for (const chunk of chunks) {
                    const prompt = prompts.extractClaims(chunk);
                    const response = await openai.chat.completions.create({
                        model: "gpt-4-turbo-preview",
                        messages: [{ role: "user", content: prompt }]
                    });
                    allClaims.push(...response.choices[0].message.content.split('\n').filter(claim => claim.trim()));
                }
                return allClaims;
            })(),
            // Generate summaries
            (async () => {
                const chunkSummaries = [];
                for (const chunk of chunks) {
                    const prompt = prompts.generateSummary(chunk);
                    const response = await openai.chat.completions.create({
                        model: "gpt-4-turbo-preview",
                        messages: [{ role: "user", content: prompt }]
                    });
                    chunkSummaries.push(response.choices[0].message.content);
                }
                return chunkSummaries;
            })()
        ]);
        
        // Process claims and generate final summary
        console.log('Processing claims through reduction pipeline...');
        const processedClaims = await processClaims(claims);
        
        // Verify & Parse claims
        console.log('Verifying claims...');
        const verifiedClaimsMap = await verifyClaims(processedClaims);
        
        console.log('Generating final summary...');
        const summary = await generateFinalSummary(summaries);

        // If no claims were found or verified, return early with just the summary
        if (!verifiedClaimsMap || Object.keys(verifiedClaimsMap).length === 0) {
            return {
                summary,
                claims: [],
                message: "No strong or potentially controversial claims were identified in this video."
            };
        }
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

export { generateFinalReport };
