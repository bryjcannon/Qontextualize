import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
dotenvConfig();

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Parse rate limit values
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // default 15 minutes
const rateLimitRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100; // default 100 requests

// Parse CORS origins
const corsOrigins = process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) :
    ['https://api.qontextualize.com'];

/**
 * Validate and sanitize environment variables
 */
function validateEnv() {
    // Required environment variables
    const required = ['OPENAI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate numeric values
    const numericVars = {
        OPENAI_MAX_RETRIES: { min: 0, max: 5 },
        OPENAI_RETRY_DELAY: { min: 100, max: 10000 },
        OPENAI_TEMPERATURE: { min: 0, max: 2 },
        OPENAI_MAX_TOKENS: { min: 100, max: 32000 },
        TRANSCRIPT_MAX_TOKENS: { min: 1000, max: 32000 },
        MIN_CLAIM_LENGTH: { min: 1, max: 100 },
        PORT: { min: 1024, max: 65535 }
    };

    for (const [key, range] of Object.entries(numericVars)) {
        if (process.env[key]) {
            const value = Number(process.env[key]);
            if (isNaN(value) || value < range.min || value > range.max) {
                throw new Error(`Invalid value for ${key}: must be between ${range.min} and ${range.max}`);
            }
        }
    }

    // Sanitize CORS origins
    if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*') {
        const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        const validOrigins = origins.every(origin => {
            try {
                new URL(origin);
                return true;
            } catch {
                return false;
            }
        });
        if (!validOrigins) {
            throw new Error('Invalid CORS_ORIGIN: must be "*" or comma-separated list of valid URLs');
        }
    }
}

// Validate environment variables before creating config
validateEnv();

/**
 * Application configuration settings
 */
export const config = {
  // Environment info
  env: {
    isDevelopment: process.env.NODE_ENV !== 'production',
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // OpenAI settings
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4.1-mini'].includes(process.env.OPENAI_MODEL) 
      ? process.env.OPENAI_MODEL 
      : 'gpt-4-turbo-preview',
    embeddingModel: ['text-embedding-3-small', 'text-embedding-3-large'].includes(process.env.OPENAI_EMBEDDING_MODEL)
      ? process.env.OPENAI_EMBEDDING_MODEL
      : 'text-embedding-ada-002',
    maxRetries: Math.min(Math.max(parseInt(process.env.OPENAI_MAX_RETRIES) || 3, 0), 5),
    retryDelay: Math.min(Math.max(parseInt(process.env.OPENAI_RETRY_DELAY) || 1000, 100), 10000),
    temperature: Math.min(Math.max(parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1, 0), 2),
    maxTokens: Math.min(Math.max(parseInt(process.env.OPENAI_MAX_TOKENS) || 4000, 100), 32000)
  },

  transcript: {
    // Chunking settings
    maxTokens: parseInt(process.env.TRANSCRIPT_MAX_TOKENS) || 10000,
    overlapTokens: parseInt(process.env.TRANSCRIPT_OVERLAP_TOKENS) || 200,
    minChunkLength: parseInt(process.env.TRANSCRIPT_MIN_CHUNK_LENGTH) || 100,
    
    // Processing settings
    maxChunks: parseInt(process.env.TRANSCRIPT_MAX_CHUNKS) || 50,
    minSentenceLength: parseInt(process.env.TRANSCRIPT_MIN_SENTENCE_LENGTH) || 10
  },

  claims: {
    // Processing settings
    minClaimLength: parseInt(process.env.MIN_CLAIM_LENGTH) || 5,
    maxClaimsPerChunk: parseInt(process.env.MAX_CLAIMS_PER_CHUNK) || 10,
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.85,
    
    // Scoring weights
    weights: {
      misinformation: 0.4,
      controversy: 0.3,
      ethics: 0.3
    },

    // Output settings
    maxSourcesPerClaim: parseInt(process.env.MAX_SOURCES_PER_CLAIM) || 3,
    maxEvidencePoints: parseInt(process.env.MAX_EVIDENCE_POINTS) || 5,
    recentSourceYears: parseInt(process.env.RECENT_SOURCE_YEARS) || 3
  },

  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    
    // CORS configuration
    cors: {
      origin: corsOrigins,
      credentials: true
    },

    // API endpoints
    endpoints: {
      proxy: '/api/proxy',
      claims: '/api/claims',
      analysis: '/api/analysis'
    },

    // Rate limiting
    rateLimit: {
      windowMs: rateLimitWindow,
      maxRequests: rateLimitRequests
    },

    // CORS settings
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  config.server.port = 3001;
  config.openai.maxRetries = 2;
}

// Freeze configuration to prevent modifications
Object.freeze(config);
Object.freeze(config.openai);
Object.freeze(config.claims);
Object.freeze(config.server);
Object.freeze(config.server.endpoints);
Object.freeze(config.server.rateLimit);
Object.freeze(config.server.cors);
