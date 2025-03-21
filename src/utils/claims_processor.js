import fs from 'fs/promises';
import path from 'path';
import { clusterClaims, scoreClaims } from './cluster_claims.js';
import openaiService from '../services/openai-service.js';
import { config } from '../config/index.js';


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
    console.log(`Starting claims processing pipeline with ${rawClaims.length} claims...`);

    // Step 1: Filter out low-quality claims
    console.log("Filtering claims...");
    const filteredClaims = await filterClaims(rawClaims);
    console.log(`Filtered to ${filteredClaims.length} quality claims`);

    // Step 2: Cluster and score claims
    console.log("Clustering and scoring claims...");
    const clusterResults = await clusterClaims(filteredClaims);
    
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
    
    // Save scores to CSV - critical step
    const dataDir = path.join(process.cwd(), 'data');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(dataDir, `claims_scores_${timestamp}.csv`);
    const csvContent = ['Claim,Risk Score,Cluster\n'];
    
    sortedClaims.forEach(({ claim, score, cluster }) => {
        const escapedClaim = `"${claim.replace(/"/g, '""')}"`;
        csvContent.push(`${escapedClaim},${score},${cluster}\n`);
    });

    try {
        // Ensure data directory exists
        try {
            await fs.access(dataDir);
        } catch {
            console.log('Creating data directory...');
            await fs.mkdir(dataDir, { recursive: true });
        }

        // Write the file
        console.log(`Writing scores to ${csvPath}...`);
        await fs.writeFile(csvPath, csvContent.join(''));
        
        // Verify the file was written
        try {
            await fs.access(csvPath);
            const stats = await fs.stat(csvPath);
            if (stats.size === 0) {
                throw new Error('CSV file was created but is empty');
            }
            console.log(`Claims scores saved successfully to: ${csvPath} (${stats.size} bytes)`);
        } catch (verifyError) {
            throw new Error(`CSV file verification failed: ${verifyError.message}`);
        }
    } catch (error) {
        console.error('CRITICAL ERROR: Failed to save claims scores CSV');
        console.error('Error details:', error);
        console.error('Current working directory:', process.cwd());
        console.error('Attempted to write to:', csvPath);
        throw new Error('Failed to save claims scores CSV - terminating process');
    }
    
    // Return processed claims and metadata
    const uniqueClaims = [...new Set(sortedClaims.map(c => c.claim))];
    return {
        originalCount: rawClaims.length,
        filteredCount: filteredClaims.length,
        uniqueCount: uniqueClaims.length,
        finalCount: sortedClaims.length,
        claims: uniqueClaims,
        scores: sortedClaims,
        clusters: clusterResults
    };
}
