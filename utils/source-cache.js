// Source caching system for Google Custom Search results
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class SourceCache {
    constructor() {
        // Validate required environment variables
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY environment variable is not set');
        }
        if (!process.env.GOOGLE_SEARCH_CX) {
            throw new Error('GOOGLE_SEARCH_CX environment variable is not set');
        }
        
        // Store API credentials
        this.apiKey = process.env.GOOGLE_API_KEY;
        this.searchEngineId = process.env.GOOGLE_SEARCH_CX;
        this.cache = new Map();
        this.cacheFile = path.join(process.cwd(), 'data', 'source-cache.json');
        this.rateLimit = [];
        this.RATE_LIMIT_WINDOW = 60000; // 1 minute
        this.MAX_REQUESTS_PER_WINDOW = 100; // Google Search API limit
        
        // Load cache from disk
        this.loadCache();
        
        // Periodically save cache to disk
        setInterval(() => this.saveCache(), 300000); // Every 5 minutes
    }
    
    async loadCache() {
        try {
            const data = await readFile(this.cacheFile, 'utf8');
            const cached = JSON.parse(data);
            
            // Convert stored timestamps back to Date objects
            for (const [key, value] of Object.entries(cached)) {
                this.cache.set(key, {
                    ...value,
                    timestamp: new Date(value.timestamp)
                });
            }
            
            console.log(`Loaded ${this.cache.size} cached search results`);
        } catch (error) {
            console.log('No existing cache found, starting fresh');
            this.cache = new Map();
        }
    }
    
    async saveCache() {
        try {
            const cacheObj = Object.fromEntries(this.cache);
            await writeFile(this.cacheFile, JSON.stringify(cacheObj, null, 2));
            console.log('Cache saved to disk');
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }
    
    canMakeRequest() {
        const now = Date.now();
        const windowStart = now - this.RATE_LIMIT_WINDOW;
        
        // Clean up old rate limit entries
        this.rateLimit = this.rateLimit.filter(t => t > windowStart);
        
        // Check rate limit
        return this.rateLimit.length < this.MAX_REQUESTS_PER_WINDOW;
    }
    
    recordRequest() {
        this.rateLimit.push(Date.now());
    }
    
    async searchGoogle(query, useFallback = false) {
        const cacheKey = `search:${query}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const cacheAge = Date.now() - cached.timestamp;
            
            // Cache is valid for 24 hours
            if (cacheAge < 24 * 60 * 60 * 1000) {
                console.log(`Cache hit for query: ${query}`);
                return cached.data;
            }
        }
        
        // If using fallback, return empty results
        if (useFallback) {
            console.log('Using fallback search (disabled due to API issues)');
            return [];
        }
        
        // Check rate limit
        if (!this.canMakeRequest()) {
            throw new Error('Rate limit exceeded for Google Search API');
        }
        
        try {
            // Construct Google Custom Search URL
            const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
            searchUrl.searchParams.append('key', this.apiKey);
            searchUrl.searchParams.append('cx', this.searchEngineId);
            searchUrl.searchParams.append('q', encodeURIComponent(query));
            
            const response = await fetch(searchUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            // Handle various error cases
            if (response.status === 403) {
                console.error('Google Search API access denied. Please check:');
                console.error('1. API key is valid and has billing enabled');
                console.error('2. Custom Search API is enabled in Google Cloud Console');
                console.error('3. Search Engine ID is correct');
                console.error('4. IP address is not blocked');
                // Switch to fallback mode
                return this.searchGoogle(query, true);
            }
            
            if (!response.ok) {
                throw new Error(`Google Search API error: ${response.status} ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error(`Unexpected response type: ${contentType}`);
                return this.searchGoogle(query, true);
            }
            
            const data = await response.json();
            
            if (!data.items) {
                console.log('No search results found');
                return [];
            }
            
            const results = data.items.map(item => {
                try {
                    return {
                        title: item.title || 'No title',
                        link: item.link,
                        snippet: item.snippet || 'No preview available',
                        domain: new URL(item.link).hostname
                    };
                } catch (urlError) {
                    console.error('Invalid URL in search result:', item.link);
                    return null;
                }
            }).filter(Boolean);
            
            // Only cache successful results
            if (results.length > 0) {
                this.cache.set(cacheKey, {
                    data: results,
                    timestamp: Date.now()
                });
            }
            
            // Record the API request
            this.recordRequest();
            
            return results;
        } catch (error) {
            console.error('Error searching Google API:', error);
            // Switch to fallback mode for any error
            return this.searchGoogle(query, true);
        }
    }
    

}

export const sourceCache = new SourceCache();
