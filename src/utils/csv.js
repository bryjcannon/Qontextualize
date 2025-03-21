/**
 * CSV utilities for data export
 */

/**
 * Convert an array of objects to CSV format
 * @param {Array<Object>} data - Array of objects to convert
 * @returns {string} CSV string
 */
export function objectsToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return '';
    }

    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                return formatCSVValue(value);
            }).join(',')
        )
    ];

    return rows.join('\n');
}

/**
 * Format a value for CSV output
 * @private
 */
function formatCSVValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    // Convert objects to JSON strings
    if (typeof value === 'object') {
        value = JSON.stringify(value);
    }

    // Convert to string
    const str = String(value);

    // Check if we need to escape this cell
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        // Escape quotes by doubling them and wrap in quotes
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}
