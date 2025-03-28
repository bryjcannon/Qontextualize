import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Save API usage stats to a CSV file
 * @param {Object} stats - API usage statistics
 * @param {string} requestId - Analysis request ID
 * @param {number} processingTime - Total processing time in seconds
 */
export async function saveStatsToCSV(stats, requestId, processingTime) {
    const timestamp = new Date().toISOString();
    const logsDir = path.join(__dirname, '../../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Prepare data for CSV
    const functionStats = Object.entries(stats.callsByFunction).map(([funcName, funcStats]) => ({
        requestId,
        timestamp,
        function: funcName,
        calls: funcStats.calls,
        tokens: funcStats.tokens,
        cost: funcStats.cost.toFixed(4),
        processingTime: processingTime.toFixed(2)
    }));

    // Calculate totals
    const totalCalls = Object.values(stats.callsByFunction).reduce((sum, func) => sum + func.calls, 0);
    const totalTokens = Object.values(stats.callsByFunction).reduce((sum, func) => sum + func.tokens, 0);
    const totalCost = Object.values(stats.callsByFunction).reduce((sum, func) => sum + func.cost, 0);

    // Add total row
    functionStats.push({
        requestId,
        timestamp,
        function: 'TOTAL',
        calls: totalCalls,
        tokens: totalTokens,
        cost: totalCost.toFixed(4),
        processingTime: processingTime.toFixed(2)
    });

    // Generate CSV content
    const csvHeader = 'Request ID,Timestamp,Function,Calls,Tokens,Cost,Processing Time (s)\n';
    const csvRows = functionStats.map(stat => 
        `${stat.requestId},${stat.timestamp},${stat.function},${stat.calls},${stat.tokens},${stat.cost},${stat.processingTime}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    // Save to daily log file
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `api_usage_${date}.csv`);
    
    // Create file with header if it doesn't exist
    if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, csvHeader);
    }

    // Append stats to the file
    fs.appendFileSync(logFile, csvRows + '\n');

    console.log(`📊 API usage stats saved to ${logFile}`);
    return logFile;
}
