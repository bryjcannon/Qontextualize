# Qontext Server

This is the proxy server for the Qontext Chrome extension that handles OpenAI API requests.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the server directory with your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
PORT=3000
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Security Features

- CORS protection (only allows requests from the Chrome extension)
- Rate limiting (100 requests per 15 minutes per IP)
- Environment-based configuration
- No client-side API key exposure

## API Endpoints

### POST /api/summarize
Generates a summary of the provided transcript using OpenAI's GPT-4.

Request body:
```json
{
    "transcript": "string"
}
```

Response:
```json
{
    "summary": "string"
}
```

### GET /health
Health check endpoint.

Response:
```json
{
    "status": "ok"
}
```

## Error Handling

The server includes comprehensive error handling:
- Input validation
- OpenAI API error handling
- Rate limiting errors
- Generic error handling

## Production Deployment

For production deployment:
1. Set up proper SSL/TLS
2. Use a process manager (e.g., PM2)
3. Set up proper monitoring
4. Update the extension's config.js with the production server URL
