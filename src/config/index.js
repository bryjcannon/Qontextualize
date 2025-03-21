/**
 * Application configuration settings
 */
export const config = {
  openai: {
    // API configuration
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: "gpt-4-turbo-preview",
    embeddingModel: "text-embedding-ada-002",
    maxRetries: 3,
    retryDelay: 1000, // ms

    // Model parameters
    temperature: 0.1,
    maxTokens: 4000,
  },

  claims: {
    // Processing settings
    minClaimLength: 5, // minimum words per claim
    maxClaimsPerChunk: 10,
    similarityThreshold: 0.85, // threshold for clustering similar claims
    
    // Scoring weights
    weights: {
      misinformation: 0.4,
      controversy: 0.3,
      ethics: 0.3
    },

    // Output settings
    maxSourcesPerClaim: 3,
    maxEvidencePoints: 5,
    recentSourceYears: 3 // consider sources within last N years as recent
  },

  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    
    // API endpoints
    endpoints: {
      proxy: '/api/proxy',
      claims: '/api/claims',
      analysis: '/api/analysis'
    },

    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100 // requests per window
    },

    // CORS settings
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
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
