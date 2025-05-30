import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { validatePath, sanitizeFilename, isOperationAllowed } from '../utils/fs-security.js';
import { validateJSON, rateLimiters, generateSecureId } from '../utils/security.js';

// JSON schemas for data validation
const SCHEMAS = {
    processed: {
        metadata: {
            type: 'object',
            required: true,
            properties: {
                timestamp: { type: 'string' },
                originalCount: { type: 'number' },
                filteredCount: { type: 'number' },
                uniqueCount: { type: 'number' },
                finalCount: { type: 'number' }
            }
        },
        claims: {
            type: 'array',
            required: true,
            itemType: 'object',
            maxItems: 10000,
            itemProperties: {
                claim: { type: 'string', required: true },
                score: { type: 'number', required: true },
                cluster: { type: 'string', required: true }
            }
        },
        clusters: {
            type: 'object',
            required: true
        }
    },
    report: {
        videoTitle: { type: 'string', required: true },
        summary: { type: 'string', required: true },
        claims: {
            type: 'array',
            required: true,
            itemType: 'object',
            maxItems: 10000,
            itemProperties: {
                title: { type: 'string', required: true },
                summary: { type: 'string', required: true },
                assessment: { type: 'string', required: true },
                consensus: { type: 'string', required: true },
                agreementStatus: { type: 'string', required: true },
                sources: {
                    type: 'array',
                    required: true,
                    itemType: 'object',
                    itemProperties: {
                        url: { type: 'string', required: true }
                    }
                }
            }
        }
    },
    raw: {
        // Raw claims have minimal validation
        claims: {
            type: 'array',
            required: true
        }
    }
};

/**
 * Service for handling all file system operations
 */
class StorageService {
    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.ensureDirectoryExists();
    }

    /**
     * Ensure required directories exist
     */
    async ensureDirectoryExists() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    /**
     * Generate a safe filename for storing claims data
     * @param {string} type - Type of data (e.g., 'raw', 'processed', 'verified')
     * @param {string} id - Unique identifier for the claims set
     * @returns {Promise<string>} Full validated path to the file
     */
    async getClaimsPath(type, id) {
        const safeType = sanitizeFilename(type);
        const safeId = sanitizeFilename(id);
        const filename = `claims_${safeType}_${safeId}.json`;
        
        return await validatePath(this.dataDir, filename, {
            allowedExtensions: new Set(['.json']),
            createDirs: true
        });
    }

    /**
     * Save claims data to storage
     * @param {Object} data - Data to save
     * @param {string} type - Type of data (e.g., 'raw', 'processed', 'verified')
     * @param {string} [id] - Optional identifier. If not provided, timestamp will be used
     * @returns {Promise<string>} The ID of the saved data
     */
    async saveClaimsData(data, type, id = null) {
        // Rate limit check
        if (!rateLimiters.fileOps.isAllowed('saveClaimsData')) {
            throw new Error('Rate limit exceeded for file operations');
        }

        // Get schema for this type
        const schema = SCHEMAS[type];
        if (!schema) {
            throw new Error(`Unknown data type: ${type}`);
        }

        // Validate input data
        const validatedData = validateJSON(data, schema);

        // Generate secure ID if not provided
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dataId = id || generateSecureId();

        try {
            const filepath = await this.getClaimsPath(type, dataId);
            
            // Check write permission
            if (!await isOperationAllowed(path.dirname(filepath), 'write')) {
                throw new Error('Write operation not allowed on target directory');
            }
            
            // Ensure directory exists
            await fs.mkdir(path.dirname(filepath), { recursive: true });
            
            // Add metadata
            const enhancedData = {
                ...validatedData,
                _metadata: {
                    savedAt: timestamp,
                    id: dataId,
                    type,
                    version: '1.0'
                }
            };
            
            const jsonData = JSON.stringify(enhancedData, null, 2);
            await fs.writeFile(filepath, jsonData, 'utf8');
            return dataId;
        } catch (error) {
            console.error(`Error saving ${type} claims data:`, error);
            throw new Error(`Failed to save ${type} claims data: ${error.message}`);
        }
    }

    /**
     * Load claims data from storage
     * @param {string} type - Type of data to load
     * @param {string} id - Identifier of the data set
     * @returns {Promise<Object>} The loaded data
     */
    async loadClaimsData(type, id) {
        // Rate limit check
        if (!rateLimiters.fileOps.isAllowed('loadClaimsData')) {
            throw new Error('Rate limit exceeded for file operations');
        }

        // Get schema for this type
        const schema = SCHEMAS[type];
        if (!schema) {
            throw new Error(`Unknown data type: ${type}`);
        }

        try {
            const filepath = await this.getClaimsPath(type, id);

            // Check read permission
            if (!await isOperationAllowed(filepath, 'read')) {
                throw new Error('Read operation not allowed');
            }

            const data = await fs.readFile(filepath, 'utf8');
            const parsedData = JSON.parse(data);
            
            // Validate loaded data
            return validateJSON(parsedData, schema);
        } catch (error) {
            console.error(`Error loading ${type} claims data:`, error);
            throw new Error(`Failed to load ${type} claims data: ${error.message}`);
        }
    }

    /**
     * Export data to CSV format
     * @param {Array<Object>} data - Array of objects to export
     * @param {string} filename - Name of the CSV file
     * @returns {Promise<string>} Path to the exported file
     */
    async exportToCSV(data, filename) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid data for CSV export');
        }

        const filepath = path.join(this.dataDir, filename);
        
        try {
            // Get headers from first object
            const headers = Object.keys(data[0]);
            
            // Convert data to CSV format
            const csvContent = [
                headers.join(','),
                ...data.map(row => 
                    headers.map(header => {
                        const cell = row[header];
                        // Handle cells that contain commas or quotes
                        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                            return `"${cell.replace(/"/g, '""')}"`;
                        }
                        return cell;
                    }).join(',')
                )
            ].join('\\n');

            await fs.writeFile(filepath, csvContent, 'utf8');
            return filepath;
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            throw new Error(`Failed to export to CSV: ${error.message}`);
        }
    }

    /**
     * List all claims data files of a specific type
     * @param {string} type - Type of claims data to list
     * @returns {Promise<Array<string>>} Array of file IDs
     */
    async listClaimsData(type) {
        try {
            const files = await fs.readdir(this.dataDir);
            const pattern = new RegExp(`^claims_${type}_(.+)\\.json$`);
            return files
                .filter(file => pattern.test(file))
                .map(file => pattern.exec(file)[1])
                .sort()
                .reverse(); // Most recent first
        } catch (error) {
            console.error(`Error listing ${type} claims data:`, error);
            throw new Error(`Failed to list ${type} claims data: ${error.message}`);
        }
    }

    /**
     * Delete claims data file
     * @param {string} type - Type of data to delete
     * @param {string} id - Identifier of the data set
     */
    async deleteClaimsData(type, id) {
        try {
            const filepath = await this.getClaimsPath(type, id);
            
            // Check delete permission
            if (!await isOperationAllowed(filepath, 'delete')) {
                throw new Error('Delete operation not allowed');
            }
            
            await fs.unlink(filepath);
        } catch (error) {
            console.error(`Error deleting ${type} claims data:`, error);
            throw new Error(`Failed to delete ${type} claims data: ${error.message}`);
        }
    }
}

// Export singleton instance
const storageService = new StorageService();
export default storageService;
