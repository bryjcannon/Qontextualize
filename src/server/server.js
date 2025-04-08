import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import fs from 'fs';
import { generateFinalReport } from '../services/report-generator.js';
import { apiStats } from '../utils/api-stats.js';
import { saveStatsToCSV } from '../utils/stats-logger.js';
import { EventEmitter } from 'events';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

// Log server startup
console.log('🚀 Server environment loaded');

// Create data directory and settings if they don't exist
const dataDir = path.join(process.cwd(), 'data');
const settingsPath = path.join(dataDir, 'settings.json');

try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(settingsPath)) {
        fs.writeFileSync(settingsPath, JSON.stringify({
            defaultSettings: true,
            saveLocalData: false,
            fullReport: true
        }, null, 2));
    }
} catch (error) {
    console.log('Warning: Could not create settings file:', error.message);
}

const app = express();

const progressEmitter = new EventEmitter();

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
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
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
            throw new Error('No transcript provided');
        }

        console.log('Starting analysis...');
        progressEmitter.emit('progress', 'transcript');

        const report = await generateFinalReport(transcript, {
            onProgress: (step) => {
                console.log('Progress update:', step);
                progressEmitter.emit('progress', step);
            }
        });

        res.json(report);
    } catch (error) {
        console.error('Error in /api/analyze:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analyze/progress', (req, res) => {
    // Add CORS headers specifically for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Send initial connection established message
    res.write('data: {"status":"connected"}\n\n');

    const sendProgress = (step) => {
        console.log('Sending progress event:', step);
        const message = JSON.stringify({ step });
        res.write(`data: ${message}\n\n`);
    };

    progressEmitter.on('progress', sendProgress);

    // Keep connection alive with periodic comments
    const keepAlive = setInterval(() => {
        if (!res.writableEnded) {
            res.write(':\n\n');
        }
    }, 30000);

    req.on('close', () => {
        console.log('Client disconnected from progress events');
        clearInterval(keepAlive);
        progressEmitter.removeListener('progress', sendProgress);
    });
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
