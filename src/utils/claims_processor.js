import { clusterClaims, scoreClaims } from './cluster_claims.js';
import openaiService from '../services/openai-service.js';
import storageService from '../services/storage-service.js';
import { config } from '../config/index.js';
import timer from './timing.js';


/**
 * Filters out low-confidence or problematic claims
 */
async function filterClaims(claims) {
    const results = await Promise.all(claims.map(claim => openaiService.filterClaim(claim)));
    return claims.filter((_, i) => results[i]);
}

/**
 * Main pipeline for processing claims
 */
export async function processClaims(rawClaims) {
    return await timer.time('Process claims', async () => {
        console.log(`Starting claims processing pipeline with ${rawClaims.length} claims...`);

        // Step 1: Filter out low-quality claims
        const filteredClaims = await timer.time(
            'Filter claims',
            () => filterClaims(rawClaims),
            { inputCount: rawClaims.length }
        );
        console.log(`Filtered to ${filteredClaims.length} quality claims`);

        // Step 2: Cluster and score claims
        const clusterResults = await timer.time(
            'Cluster and score claims',
            () => clusterClaims(filteredClaims),
            { claimCount: filteredClaims.length }
        );
    
        // Flatten clusters into a single list of scored claims
        const allScoredClaims = [];
        for (const [clusterName, clusterText] of Object.entries(clusterResults)) {
            // Parse claims and scores from cluster text
            const clusterClaims = clusterText.split('\n').map(line => {
                const match = line.match(/\[Risk Score: (\d+\.\d+)\] (.+)/);
                return match ? {
                    claim: match[2],
                    score: parseFloat(match[1]),
                    cluster: clusterName
                } : null;
            }).filter(Boolean);
            
            allScoredClaims.push(...clusterClaims);
        }
        
        // Sort all claims by score
        const sortedClaims = allScoredClaims.sort((a, b) => b.score - a.score);
        
        // Save scores to CSV
        const csvData = sortedClaims.map(({ claim, score, cluster }) => ({
            Claim: claim,
            'Risk Score': score,
            Cluster: cluster
        }));

        // Get unique claims
        const uniqueClaims = [...new Set(sortedClaims.map(c => c.claim))];

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Save CSV and claims data
            await timer.time('Save claims data', async () => {
                const csvPath = await storageService.exportToCSV(csvData, `claims_scores_${timestamp}.csv`);
                console.log(`Claims scores saved successfully to: ${csvPath}`);

                // Save the full claims data for future reference
                const claimsData = {
                    metadata: {
                        timestamp,
                        originalCount: rawClaims.length,
                        filteredCount: filteredClaims.length,
                        uniqueCount: uniqueClaims.length,
                        finalCount: sortedClaims.length
                    },
                    claims: sortedClaims,
                    clusters: clusterResults
                };
                await storageService.saveClaimsData(claimsData, 'processed', timestamp);
            }, {
                uniqueClaimsCount: uniqueClaims.length,
                totalClaimsCount: sortedClaims.length
            });
        } catch (error) {
            console.error('CRITICAL ERROR: Failed to save claims data');
            console.error('Error details:', error);
            throw new Error('Failed to save claims data - terminating process');
        }
        
        // Return processed claims and metadata
        return {
            originalCount: rawClaims.length,
            filteredCount: filteredClaims.length,
            uniqueCount: uniqueClaims.length,
            finalCount: sortedClaims.length,
            claims: uniqueClaims,
            scores: sortedClaims,
            clusters: clusterResults
        };
    });
}
