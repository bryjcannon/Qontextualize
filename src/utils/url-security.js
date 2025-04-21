/**
 * URL security and validation utilities
 */

// List of allowed domains for scientific sources
const ALLOWED_DOMAINS = new Set([
    // Academic Publishers & Journals
  "nature.com",
  "sciencemag.org",
  "pnas.org",
  "plos.org",
  "cell.com",
  "thelancet.com",
  "bmj.com",
  "nejm.org",
  "science.org",
  "sciencedirect.com",
  "springer.com",
  "link.springer.com",
  "wiley.com",
  "onlinelibrary.wiley.com",
  "tandfonline.com",
  "oup.com",
  "academic.oup.com",
  "journals.aps.org",
  "arc.aiaa.org",
  "iopscience.iop.org",
  "pubs.acs.org",
  "elsevier.com",
  "sagepub.com",
  "cambridge.org",
  "oxfordjournals.org",
  "emerald.com",
  "degruyter.com",
  "frontiersin.org"

  // Preprint & Open Access
  "arxiv.org",
  "biorxiv.org",
  "medrxiv.org",
  "chemrxiv.org",
  "researchsquare.com",
  "f1000research.com",
  "scienceopen.com",
  "researchgate.net",

  // Research Databases & Repositories
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "doi.org",
  "jstor.org",
  "ssrn.com",
  "digitalcollections.nypl.org",
  "archive.org",
  "icpsr.umich.edu",

  // Professional Societies & Organizations
  "ieee.org",
  "ieeeexplore.ieee.org",
  "acm.org",
  "dl.acm.org",
  "aps.org",
  "ams.org",
  "acs.org",
  "rsc.org",

  // Research Institutions & Governmental Bodies
  "nih.gov",
  "usgs.gov",
  "who.int",
  "cdc.gov",
  "europa.eu",
  "nasa.gov",
  "esa.int",
  "fnal.gov",
  "cern.ch",
  "un.org",
  "nber.org",
  "edu",
  "ac.uk",
  "edu.au",

  // Discipline-Specific Domains: Earth Science & Geology
  "earthobservatory.nasa.gov",
  "geosociety.org",

  // Discipline-Specific Domains: Aviation
  "faa.gov",
  "easa.europa.eu",
  "skybrary.aero",

  // Discipline-Specific Domains: Climate Science
  "climate.gov",
  "ipcc.ch",
  "climate.nasa.gov",

  // Discipline-Specific Domains: History & Geography / Primary Sources
  "loc.gov",
  "nationalgeographic.com",
  "geograph.org.uk"
    
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
 * Check if a hostname is an internal IP
 * @param {string} hostname - Hostname to check
 * @returns {boolean} Whether the hostname is an internal IP
 */
function isInternalIP(hostname) {
    return hostname.match(/^(?:127\.|169\.254\.|192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.).*$/) !== null;
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

        // Block all internal URLs and IPs
        if (parsed.hostname === 'localhost' || 
            isInternalIP(parsed.hostname)) {
            console.warn(`Rejected internal URL: ${url}`);
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
