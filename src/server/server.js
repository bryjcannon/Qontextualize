import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import { generateFinalReport } from '../services/report-generator.js';
import { apiStats } from '../utils/api-stats.js';
import { saveStatsToCSV } from '../utils/stats-logger.js';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

// Log server startup
console.log('🚀 Server environment loaded');

const app = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // increase limit for development
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors({
    origin: true,
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Apply rate limiting only to /api routes
app.use('/api', limiter);

// Timing middleware
const timingMiddleware = (req, res, next) => {
    req.startTime = Date.now();
    next();
};

// Add timing middleware to analyze endpoint
app.post('/api/analyze', timingMiddleware, async (req, res) => {
    try {
        const { transcript, clientStartTime, fullReport, saveLocalData } = req.body;
        
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

        // Log API usage summary
        const stats = apiStats.stats;
        const totalCalls = Object.values(stats.callsByFunction).reduce((sum, func) => sum + func.calls, 0);
        const totalTokens = Object.values(stats.callsByFunction).reduce((sum, func) => sum + func.tokens, 0);
        const totalCost = Object.values(stats.callsByFunction).reduce((sum, func) => sum + func.cost, 0);

        console.log('=== OpenAI API Usage Summary ===');
        console.log('📊 Usage by Function:');
        Object.entries(stats.callsByFunction).forEach(([funcName, funcStats]) => {
            console.log(`  ${funcName}:`);
            console.log(`    🔄 Calls: ${funcStats.calls}`);
            console.log(`    📝 Tokens: ${funcStats.tokens}`);
            console.log(`    💰 Cost: $${funcStats.cost.toFixed(4)}`);
        });
        console.log('\n📈 Total Usage:');
        console.log(`🔄 Total API Calls: ${totalCalls}`);
        console.log(`📝 Total Tokens Used: ${totalTokens}`);
        console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);
        console.log('==============================\n');

        // Save stats to CSV only if saveLocalData is enabled
        if (saveLocalData) {
            await saveStatsToCSV(stats, req.startTime, totalProcessingTime / 1000);
        }

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
