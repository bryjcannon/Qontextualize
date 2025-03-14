import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { generateFinalReport } from '../report-generator.js';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

// Log environment variables for debugging
console.log('🔑 Environment Variables loaded:', {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? 'Set' : 'Not Set',
    GOOGLE_SEARCH_CX: process.env.GOOGLE_SEARCH_CX ? 'Set' : 'Not Set'
});

const app = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors({
    origin: ['chrome-extension://*', 'http://localhost:3000'],
    methods: ['POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '50mb' }));
app.use(limiter);

// Timing middleware
const timingMiddleware = (req, res, next) => {
    req.startTime = Date.now();
    next();
};

// Add timing middleware to analyze endpoint
app.post('/api/analyze', timingMiddleware, async (req, res) => {
    try {
        const { transcript, clientStartTime, fullReport } = req.body;
        
        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        // Set full report environment variable for this request
        process.env.FULL_REPORT = fullReport ? 'true' : 'false';

        console.log('Analyzing transcript...');
        const report = await generateFinalReport(transcript);
        console.log('Analysis complete');

        // Calculate and log timing metrics
        const serverProcessingTime = Date.now() - req.startTime;
        const totalProcessingTime = Date.now() - (clientStartTime || req.startTime);
        const timestamp = new Date().toISOString();

        // Log detailed timing information to terminal
        console.log('\n=== Video Analysis Timing Metrics ===');
        console.log(`🎯 Analysis Request ID: ${req.startTime}`);
        console.log(`⚡ Server Processing Time: ${(serverProcessingTime / 1000).toFixed(2)}s`);
        console.log(`🕒 Total Processing Time: ${(totalProcessingTime / 1000).toFixed(2)}s`);
        console.log(`📅 Completed at: ${new Date(timestamp).toLocaleString()}`);
        console.log('==================================\n');

        res.json(report);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: error.message,
            claims: [],
            markdown: `Error analyzing transcript: ${error.message}`
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
console.log('Claim analysis service ready');
});
