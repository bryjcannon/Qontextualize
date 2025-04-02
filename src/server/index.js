import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
dotenv.config({ path: envFile });

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI with error handling
let openai;
try {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
} catch (error) {
    console.error('Failed to initialize OpenAI:', error);
    process.exit(1);
}

// Configure CORS
const corsOptions = {
    origin: [
        'chrome-extension://*', // Allow all Chrome extensions
        'https://api.qontextualize.com', // Your API domain
        process.env.CORS_ORIGIN // Additional allowed origin from env
    ].filter(Boolean), // Remove any undefined values
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Allow credentials
};
app.use(cors(corsOptions));

// Configure rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use(limiter);

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OpenAI summarization endpoint
app.post('/api/summarize', async (req, res) => {
    try {
        const { transcript } = req.body;
        
        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that summarizes video transcripts concisely and accurately."
                },
                {
                    role: "user",
                    content: `Please summarize this video transcript:\n\n${transcript}`
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const summary = completion.choices[0].message.content;
        res.json({ summary });
    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ 
            error: 'Failed to summarize transcript',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something broke!',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
});
