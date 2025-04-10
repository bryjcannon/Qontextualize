/**
 * Centralized error handling and logging utility
 */

/**
 * Standardized error types for consistent handling
 */
export const ErrorTypes = {
    VALIDATION: 'VALIDATION_ERROR',
    API: 'API_ERROR',
    PROCESSING: 'PROCESSING_ERROR',
    STORAGE: 'STORAGE_ERROR'
};

/**
 * Create a standardized error object
 * @param {string} type - Error type from ErrorTypes
 * @param {string} message - Error message
 * @param {Error} [originalError] - Original error if wrapping
 * @returns {Error} Standardized error object
 */
export function createError(type, message, originalError = null) {
    const error = new Error(message);
    error.type = type;
    error.timestamp = new Date().toISOString();
    
    if (originalError) {
        error.originalError = originalError;
        error.stack = originalError.stack;
    }
    
    return error;
}

/**
 * Log an error with consistent formatting
 * @param {Error} error - Error to log
 * @param {string} context - Context where error occurred
 */
export function logError(error, context) {
    console.error(`[${error.timestamp || new Date().toISOString()}] ${context}:`, {
        type: error.type || 'UNKNOWN',
        message: error.message,
        stack: error.stack,
        originalError: error.originalError
    });
}

/**
 * Safely execute a function with error handling
 * @param {Function} fn - Function to execute
 * @param {string} context - Context for error logging
 * @param {string} errorType - Type of error if failed
 * @returns {Promise} Result of the function or throws standardized error
 */
export async function tryCatch(fn, context, errorType = ErrorTypes.PROCESSING) {
    try {
        return await fn();
    } catch (error) {
        const wrappedError = createError(
            errorType,
            `Error in ${context}: ${error.message}`,
            error
        );
        logError(wrappedError, context);
        throw wrappedError;
    }
}

/**
 * Validate input against a schema with consistent error handling
 * @param {Object} input - Input to validate
 * @param {Object} schema - Schema to validate against
 * @param {string} context - Context for error messages
 * @throws {Error} Validation error if invalid
 */
export function validateInput(input, schema, context) {
    const errors = [];
    
    for (const [key, rules] of Object.entries(schema)) {
        const value = input[key];
        
        if (rules.required && (value === undefined || value === null)) {
            errors.push(`${key} is required`);
            continue;
        }
        
        if (value !== undefined && value !== null) {
            if (rules.type && typeof value !== rules.type) {
                errors.push(`${key} must be of type ${rules.type}`);
            }
            
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${key} must be >= ${rules.min}`);
            }
            
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${key} must be <= ${rules.max}`);
            }
            
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push(`${key} has invalid format`);
            }
        }
    }
    
    if (errors.length > 0) {
        throw createError(
            ErrorTypes.VALIDATION,
            `Validation failed in ${context}: ${errors.join(', ')}`
        );
    }
}
