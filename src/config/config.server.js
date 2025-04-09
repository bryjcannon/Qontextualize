import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

// API configuration
const config = {
    API_ENDPOINT: 'https://api.qontextualize.com/api/analyze',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    
    // Google Custom Search API configuration
    // Add any server-specific config here
};

export default config;
