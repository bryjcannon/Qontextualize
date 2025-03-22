/**
 * URL security and validation utilities
 */

// List of allowed domains for scientific sources
const ALLOWED_DOMAINS = new Set([
    // Academic domains
    'nature.com',
    'science.org',
    'sciencedirect.com',
    'springer.com',
    'wiley.com',
    'tandfonline.com',
    'oup.com',
    'ieee.org',
    'acm.org',
    'jstor.org',
    
    // Research institutions
    'nih.gov',
    'edu',
    'ac.uk',
    'edu.au',
    
    // Scientific organizations
    'who.int',
    'cdc.gov',
    'europa.eu',
    'nasa.gov',
    
    // Preprint servers
    'arxiv.org',
    'biorxiv.org',
    'medrxiv.org',
    
    // Add more trusted domains as needed
]);

/**
 * Check if a domain or its parent domain is in the allowed list
 * @param {string} domain - Domain to check
 * @returns {boolean} Whether the domain is allowed
 */
function isAllowedDomain(domain) {
    // Remove www prefix if present
    domain = domain.replace(/^www\./, '');
    
    // Check the domain and all parent domains
    const parts = domain.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
        const testDomain = parts.slice(i).join('.');
        if (ALLOWED_DOMAINS.has(testDomain)) {
            return true;
        }
    }
    return false;
}

/**
 * Validate and sanitize a URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.requireHttps=true] - Whether to require HTTPS
 * @param {boolean} [options.allowedDomainsOnly=true] - Whether to only allow domains in the allowed list
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url, options = {}) {
    const {
        requireHttps = true,
        allowedDomainsOnly = true
    } = options;

    try {
        // Basic URL validation
        const parsed = new URL(url);

        // Protocol validation
        if (requireHttps && parsed.protocol !== 'https:') {
            console.warn(`Rejected URL due to non-HTTPS protocol: ${url}`);
            return null;
        }

        // Prevent localhost/internal IPs
        if (parsed.hostname === 'localhost' || 
            parsed.hostname.match(/^(?:127\.|169\.254\.|192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.).*/)) {
            console.warn(`Rejected internal/localhost URL: ${url}`);
            return null;
        }

        // Domain validation
        if (allowedDomainsOnly && !isAllowedDomain(parsed.hostname)) {
            console.warn(`Rejected URL from non-allowed domain: ${parsed.hostname}`);
            return null;
        }

        // Remove fragments and clean query parameters
        parsed.hash = '';
        
        // Only allow specific query parameters if needed
        // const allowedParams = new Set(['id', 'v', 'page']);
        // const params = new URLSearchParams(parsed.search);
        // for (const param of params.keys()) {
        //     if (!allowedParams.has(param)) {
        //         params.delete(param);
        //     }
        // }
        // parsed.search = params.toString();

        return parsed.toString();
    } catch (error) {
        console.warn(`Invalid URL format: ${url}`, error);
        return null;
    }
}

/**
 * Extract and validate domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string|null} Domain name or null if invalid
 */
export function extractDomain(url) {
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        return domain;
    } catch {
        return null;
    }
}

/**
 * Validate a list of URLs
 * @param {string[]} urls - URLs to validate
 * @param {Object} options - Validation options
 * @returns {string[]} Array of valid URLs
 */
export function validateUrls(urls, options = {}) {
    return urls
        .map(url => sanitizeUrl(url, options))
        .filter(Boolean); // Remove null values
}

export default {
    sanitizeUrl,
    extractDomain,
    validateUrls,
    ALLOWED_DOMAINS
};
