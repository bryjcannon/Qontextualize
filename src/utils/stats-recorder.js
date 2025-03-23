import fs from 'fs/promises';
import path from 'path';

/**
 * Converts a JavaScript object to a CSV row
 * @param {Object} data - The data object to convert
 * @param {Array} headers - The headers to use for the CSV
 * @returns {string} The CSV row
 */
function objectToCsvRow(data, headers) {
    return headers.map(header => {
        const value = data[header];
        // Handle nested objects by converting to JSON string
        if (typeof value === 'object' && value !== null) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        // Handle strings that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
    }).join(',');
}

/**
 * Saves processing statistics to a CSV file
 * @param {Object} stats - The statistics to save
 * @param {Object} stats.apiUsage - API usage statistics
 * @param {Object} stats.processingTime - Processing time statistics
 * @param {Object} stats.metadata - Additional metadata
 */
export async function saveProcessingStats(stats) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `processing_data_run_${timestamp}.csv`;
    const filepath = path.join(process.cwd(), 'data', filename);

    // Define headers for our CSV
    const headers = [
        'timestamp',
        'totalApiCalls',
        'totalTokens',
        'estimatedCost',
        'processingTimeMs',
        'chunkCount',
        'claimsCount',
        'summaryCount'
    ];

    // Create CSV header row
    const headerRow = headers.join(',');

    // Create data row
    const data = {
        timestamp: new Date().toISOString(),
        totalApiCalls: stats.apiUsage.totalCalls,
        totalTokens: stats.apiUsage.totalTokens,
        estimatedCost: stats.apiUsage.estimatedCost,
        processingTimeMs: stats.processingTime,
        chunkCount: stats.metadata.chunkCount,
        claimsCount: stats.metadata.claimsCount,
        summaryCount: stats.metadata.summaryCount
    };

    const dataRow = objectToCsvRow(data, headers);

    // Write to file
    try {
        // Check if file exists
        try {
            await fs.access(filepath);
            // File exists, append data row
            await fs.appendFile(filepath, '\\n' + dataRow, 'utf8');
        } catch {
            // File doesn't exist, create with header and data
            await fs.writeFile(filepath, headerRow + '\\n' + dataRow, 'utf8');
        }
        
        console.log(`Processing statistics saved to ${filename}`);
        
        // Save detailed API usage to a separate JSON file for reference
        const detailedStatsFile = path.join(
            process.cwd(), 
            'data', 
            `processing_details_${timestamp}.json`
        );
        await fs.writeFile(
            detailedStatsFile, 
            JSON.stringify(stats, null, 2), 
            'utf8'
        );
        
    } catch (error) {
        console.error('Error saving processing statistics:', error);
        throw error;
    }
}
