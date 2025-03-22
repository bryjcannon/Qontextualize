/**
 * File system security utilities
 */

import { join, resolve, normalize, isAbsolute, relative, parse } from 'path';
import { constants } from 'fs';
import { access } from 'fs/promises';

// Allowed file extensions for different operations
const ALLOWED_EXTENSIONS = {
    data: new Set(['.json', '.csv']),
    text: new Set(['.txt', '.md']),
    media: new Set(['.mp3', '.mp4', '.wav']),
    all: new Set(['.json', '.csv', '.txt', '.md', '.mp3', '.mp4', '.wav'])
};

// Characters not allowed in filenames (beyond OS restrictions)
const FILENAME_BLACKLIST = /[<>:"|?*\u0000-\u001F]/g;

/**
 * Validate and sanitize a file path
 * @param {string} basePath - Base directory path (must be absolute)
 * @param {string} relativePath - Relative path to validate
 * @param {Object} options - Validation options
 * @param {Set<string>} [options.allowedExtensions] - Set of allowed file extensions
 * @param {boolean} [options.createDirs=false] - Whether to allow directory creation
 * @param {boolean} [options.mustExist=false] - Whether the path must exist
 * @returns {Promise<string>} Sanitized absolute path
 * @throws {Error} If path is invalid or unauthorized
 */
export async function validatePath(basePath, relativePath, options = {}) {
    const {
        allowedExtensions = ALLOWED_EXTENSIONS.all,
        createDirs = false,
        mustExist = false
    } = options;

    // Ensure base path is absolute
    if (!isAbsolute(basePath)) {
        throw new Error('Base path must be absolute');
    }

    // Clean the relative path
    const cleanPath = normalize(relativePath)
        .replace(FILENAME_BLACKLIST, '')  // Remove unsafe characters
        .replace(/\.{2,}/g, '.');        // Remove path traversal attempts

    // Get the absolute path
    const absPath = resolve(basePath, cleanPath);

    // Ensure the path stays within the base directory
    const relPath = relative(basePath, absPath);
    if (relPath.startsWith('..') || isAbsolute(relPath)) {
        throw new Error('Path traversal attempt detected');
    }

    // Validate file extension if path has one
    const { ext } = parse(absPath);
    if (ext && !allowedExtensions.has(ext.toLowerCase())) {
        throw new Error(`File extension '${ext}' not allowed`);
    }

    // Check if path exists if required
    if (mustExist) {
        try {
            await access(absPath, constants.F_OK);
        } catch {
            throw new Error('Path does not exist');
        }
    }

    return absPath;
}

/**
 * Sanitize a filename (not path)
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
    return filename
        .replace(FILENAME_BLACKLIST, '')  // Remove unsafe characters
        .replace(/\.{2,}/g, '.')         // Remove multiple dots
        .replace(/^\./, '')              // Remove leading dot
        .slice(0, 255);                  // Limit length
}

/**
 * Check if a file operation is allowed
 * @param {string} path - Path to check
 * @param {string} operation - Operation type ('read', 'write', 'delete')
 * @returns {Promise<boolean>} Whether operation is allowed
 */
export async function isOperationAllowed(path, operation) {
    try {
        const { ext } = parse(path);
        const parent = resolve(path, '..');
        
        // For write operations, only check parent directory permissions
        if (operation === 'write') {
            try {
                // If parent exists, check if it's writable
                await access(parent, constants.F_OK);
                await access(parent, constants.W_OK);
                return true;
            } catch {
                // If parent doesn't exist, that's okay - it will be created
                return true;
            }
        }
        
        // For read and delete operations, check file permissions
        switch (operation) {
            case 'read':
                // File must exist and be readable
                await access(path, constants.F_OK);
                await access(path, constants.R_OK);
                break;
                
            case 'delete':
                // File must exist and parent directory must be writable
                await access(path, constants.F_OK);
                await access(parent, constants.W_OK);
                break;
                
            default:
                return false;
        }
        
        // Check if extension is allowed (for existing files)
        if (ext && !ALLOWED_EXTENSIONS.all.has(ext.toLowerCase())) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

export default {
    validatePath,
    sanitizeFilename,
    isOperationAllowed,
    ALLOWED_EXTENSIONS
};
