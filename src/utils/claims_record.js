import { writeFile } from 'fs/promises';
import path from 'path';

/**
 * Saves a summary of extracted claims to a JSON file
 * @param {Set<string>} uniqueClaims - Set of unique claims
 * @returns {Promise<string>} Path to the saved file
 */
export async function saveClaimsSummary(uniqueClaims) {
    const uniqueClaimsArray = Array.from(uniqueClaims);
    
    // Create a summary object
    const summary = {
        totalClaims: uniqueClaimsArray.length,
        timestamp: new Date().toISOString(),
        claims: uniqueClaimsArray,
        topics: uniqueClaimsArray
            .map(claim => {
                const parts = claim.split(':');
                return parts.length > 1 ? parts[0].trim() : null;
            })
            .filter(Boolean)
    };
    
    try {
        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        await import('fs').then(fs => fs.promises.mkdir(dataDir, { recursive: true }));
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `claims_summary_${timestamp}.json`;
        const filepath = path.join(dataDir, filename);
        
        // Write summary to file with pretty printing
        await writeFile(filepath, JSON.stringify(summary, null, 2));
        console.log(`Claims summary saved to ${filepath}`);
        
        return filepath;
    } catch (error) {
        console.error('Error saving claims summary:', error);
        throw error;
    }
}

/**
 * Loads a claims summary from a file
 * @param {string} filepath - Path to the summary file
 * @returns {Promise<Object>} The claims summary object
 */
export async function loadClaimsSummary(filepath) {
    try {
        const content = await import('fs').then(fs => fs.promises.readFile(filepath, 'utf8'));
        return JSON.parse(content);
    } catch (error) {
        console.error('Error loading claims summary:', error);
        throw error;
    }
}
