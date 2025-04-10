/**
 * Utility for handling retries of async operations
 */

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.baseDelay - Base delay in milliseconds
 * @param {Function} options.onRetry - Optional callback for retry attempts
 * @returns {Promise} Result of the operation
 */
export async function withRetry(operation, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        onRetry = (error, attempt) => console.error(`Attempt ${attempt} failed:`, error)
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            onRetry(error, attempt);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Decorator function to add retry behavior to class methods
 * @param {Object} options - Retry options
 * @returns {Function} Decorator function
 */
export function retryable(options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            return withRetry(() => originalMethod.apply(this, args), options);
        };
        
        return descriptor;
    };
}
