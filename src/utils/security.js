/**
 * Security utilities for input validation and sanitization
 */

import crypto from 'crypto';

/**
 * Generate a secure random identifier
 * @param {number} [length=32] - Length of the identifier
 * @returns {string} Secure random identifier
 */
export function generateSecureId(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} Hashed data
 */
export function hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate and sanitize JSON input
 * @param {any} input - Input to validate
 * @param {Object} schema - JSON schema to validate against
 * @returns {Object} Sanitized data
 * @throws {Error} If validation fails
 */
export function validateJSON(input, schema) {
    // Basic type checking
    if (typeof input !== 'object' || input === null) {
        throw new Error('Invalid input: must be an object');
    }

    const sanitized = {};
    
    // Only copy allowed fields from schema
    for (const [key, def] of Object.entries(schema)) {
        if (key in input) {
            const value = input[key];
            
            // Type validation
            if (def.type && typeof value !== def.type && 
                !(def.type === 'array' && Array.isArray(value))) {
                throw new Error(`Invalid type for ${key}: expected ${def.type}`);
            }
            
            // Object validation
            if (def.type === 'object' && def.properties) {
                sanitized[key] = validateJSON(value, def.properties);
                continue;
            }
            
            // Array validation
            if (def.type === 'array') {
                if (!Array.isArray(value)) {
                    throw new Error(`${key} must be an array`);
                }
                
                if (def.maxItems && value.length > def.maxItems) {
                    throw new Error(`${key} exceeds maximum items of ${def.maxItems}`);
                }
                
                if (def.itemType || def.itemProperties) {
                    sanitized[key] = value.map((item, i) => {
                        if (def.itemType && typeof item !== def.itemType) {
                            throw new Error(`Invalid type for item ${i} in ${key}`);
                        }
                        if (def.itemProperties) {
                            return validateJSON(item, def.itemProperties);
                        }
                        return item;
                    });
                    continue;
                }
            }
            
            // String validation
            if (def.type === 'string') {
                if (def.maxLength && value.length > def.maxLength) {
                    throw new Error(`${key} exceeds maximum length of ${def.maxLength}`);
                }
                if (def.pattern && !def.pattern.test(value)) {
                    throw new Error(`${key} does not match required pattern`);
                }
            }
            
            // Number validation
            if (def.type === 'number') {
                if (typeof value !== 'number') {
                    throw new Error(`${key} must be a number`);
                }
                if (def.min !== undefined && value < def.min) {
                    throw new Error(`${key} below minimum value of ${def.min}`);
                }
                if (def.max !== undefined && value > def.max) {
                    throw new Error(`${key} exceeds maximum value of ${def.max}`);
                }
            }
            
            sanitized[key] = value;
        } else if (def.required) {
            throw new Error(`Missing required field: ${key}`);
        }
    }
    
    return sanitized;
}

/**
 * Rate limiting utility
 */
class RateLimiter {
    constructor(windowMs = 60000, maxRequests = 100) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.requests = new Map();
    }
    
    /**
     * Check if operation should be rate limited
     * @param {string} key - Identifier for the operation
     * @returns {boolean} Whether operation should be allowed
     */
    isAllowed(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Clean old entries
        for (const [k, time] of this.requests) {
            if (time < windowStart) {
                this.requests.delete(k);
            }
        }
        
        // Check request count
        const requestCount = Array.from(this.requests.values())
            .filter(time => time > windowStart)
            .length;
            
        if (requestCount >= this.maxRequests) {
            return false;
        }
        
        // Record new request
        this.requests.set(crypto.randomBytes(16).toString('hex'), now);
        return true;
    }
}

// Create rate limiters for different operations
export const rateLimiters = {
    fileOps: new RateLimiter(60000, 100),    // 100 file operations per minute
    apiCalls: new RateLimiter(60000, 50),     // 50 API calls per minute
    exports: new RateLimiter(300000, 10)      // 10 exports per 5 minutes
};

/**
 * Content Security Policy builder
 */
export class CSPBuilder {
    constructor() {
        this.directives = {
            'default-src': ["'self'"],
            'script-src': ["'self'"],
            'style-src': ["'self'"],
            'img-src': ["'self'"],
            'connect-src': ["'self'"],
            'font-src': ["'self'"],
            'object-src': ["'none'"],
            'media-src': ["'self'"],
            'frame-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
            'frame-ancestors': ["'none'"]
        };
    }
    
    /**
     * Add source to directive
     * @param {string} directive - CSP directive
     * @param {string} source - Source to add
     * @returns {CSPBuilder} this for chaining
     */
    addSource(directive, source) {
        if (!this.directives[directive]) {
            this.directives[directive] = [];
        }
        this.directives[directive].push(source);
        return this;
    }
    
    /**
     * Build CSP header string
     * @returns {string} CSP header value
     */
    build() {
        return Object.entries(this.directives)
            .map(([key, values]) => `${key} ${values.join(' ')}`)
            .join('; ');
    }
}

export default {
    generateSecureId,
    hashData,
    validateJSON,
    rateLimiters,
    CSPBuilder
};
