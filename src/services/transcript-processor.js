import { config } from '../config/index.js';

/**
 * Handles transcript processing, chunking, and validation
 */
class TranscriptProcessor {
    /**
     * Create a new TranscriptProcessor
     * @param {Object} options - Configuration options
     * @param {number} options.maxTokens - Maximum tokens per chunk (default from config)
     * @param {number} options.overlapTokens - Number of tokens to overlap (default from config)
     * @param {number} options.minChunkLength - Minimum characters per chunk (default from config)
     */
    constructor(options = {}) {
        this.options = {
            maxTokens: options.maxTokens || config.transcript.maxTokens || 10000,
            overlapTokens: options.overlapTokens || config.transcript.overlapTokens || 200,
            minChunkLength: options.minChunkLength || config.transcript.minChunkLength || 100
        };

        // Convert token counts to approximate character lengths
        this.maxChars = this.options.maxTokens * 4;
        this.overlapChars = this.options.overlapTokens * 4;
    }

    /**
     * Estimates the number of tokens in a text string
     * This is a rough estimate based on GPT tokenization patterns
     * @param {string} text - The text to estimate tokens for
     * @returns {number} Estimated token count
     */
    estimateTokenCount(text) {
        // GPT models typically tokenize on word boundaries and common subwords
        // A rough estimate is 4 characters per token on average
        return Math.ceil(text.length / 4);
    }

    /**
     * Validates a single chunk of transcript
     * @param {string} chunk - The chunk to validate
     * @returns {Object} Validation result with isValid and reason
     */
    validateChunk(chunk) {
        if (!chunk || typeof chunk !== 'string') {
            return {
                isValid: false,
                reason: 'Chunk must be a non-empty string'
            };
        }

        if (chunk.length < this.options.minChunkLength) {
            return {
                isValid: false,
                reason: `Chunk length (${chunk.length}) is below minimum (${this.options.minChunkLength})`
            };
        }

        const tokenCount = this.estimateTokenCount(chunk);
        if (tokenCount > this.options.maxTokens) {
            return {
                isValid: false,
                reason: `Chunk token count (${tokenCount}) exceeds maximum (${this.options.maxTokens})`
            };
        }

        return { isValid: true };
    }

    /**
     * Logs statistics about the chunked transcript
     * @param {string[]} chunks - Array of transcript chunks
     */
    logChunkStats(chunks) {
        console.log(`\nTranscript Processing Statistics:`);
        console.log(`Total chunks: ${chunks.length}`);
        
        let totalTokens = 0;
        let minTokens = Infinity;
        let maxTokens = 0;

        chunks.forEach((chunk, i) => {
            const tokenCount = this.estimateTokenCount(chunk);
            totalTokens += tokenCount;
            minTokens = Math.min(minTokens, tokenCount);
            maxTokens = Math.max(maxTokens, tokenCount);

            console.log(`Chunk ${i + 1}: ~${tokenCount} tokens (${chunk.length} chars)`);
        });

        const avgTokens = Math.round(totalTokens / chunks.length);
        console.log(`\nSummary:`);
        console.log(`- Average tokens per chunk: ${avgTokens}`);
        console.log(`- Min tokens in a chunk: ${minTokens}`);
        console.log(`- Max tokens in a chunk: ${maxTokens}`);
        console.log(`- Total estimated tokens: ${totalTokens}\n`);
    }

    /**
     * Splits transcript into overlapping chunks optimized for processing
     * @param {string} transcript - The full transcript text
     * @returns {string[]} Array of transcript chunks
     * @throws {Error} If transcript is invalid or chunking fails
     */
    chunkTranscript(transcript) {
        if (!transcript || typeof transcript !== 'string') {
            throw new Error('Invalid transcript: must be a non-empty string');
        }

        // Split transcript into sentences
        const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
        const chunks = [];
        let currentChunk = '';
        let overlapSegment = '';

        for (const sentence of sentences) {
            // Add new sentence to the current chunk
            const newChunk = currentChunk + sentence + ' ';
            
            if (this.estimateTokenCount(newChunk) > this.options.maxTokens && currentChunk.length > 0) {
                // Validate current chunk before storing
                const validation = this.validateChunk(currentChunk.trim());
                if (!validation.isValid) {
                    console.warn(`Warning: Invalid chunk detected - ${validation.reason}`);
                }

                // Store the current chunk
                chunks.push(currentChunk.trim());
                
                // Get the overlap segment from the end of the current chunk
                const words = currentChunk.split(' ');
                overlapSegment = words
                    .slice(Math.max(0, words.length - this.options.overlapTokens))
                    .join(' ');
                
                // Start new chunk with overlap
                currentChunk = overlapSegment + ' ' + sentence + ' ';
            } else {
                currentChunk = newChunk;
            }
        }

        // Add the final chunk if not empty
        if (currentChunk.trim().length > 0) {
            const validation = this.validateChunk(currentChunk.trim());
            if (!validation.isValid) {
                console.warn(`Warning: Invalid final chunk detected - ${validation.reason}`);
            }
            chunks.push(currentChunk.trim());
        }

        // Log chunking statistics
        this.logChunkStats(chunks);

        return chunks;
    }
}

// Export singleton instance
const transcriptProcessor = new TranscriptProcessor();
export default transcriptProcessor;
