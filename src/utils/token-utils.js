/**
 * Utilities for token estimation and text processing
 */

/**
 * Estimate token count based on character count and word boundaries
 * This is a rough estimate that works well enough for chunking purposes
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(text) {
    if (!text) return 0;
    
    // Count words (including numbers and contractions)
    const words = text.trim().split(/\s+/).length;
    
    // Count special characters (punctuation, etc)
    const specialChars = text.replace(/[a-zA-Z0-9\s]/g, '').length;
    
    // Estimate: each word is ~1.3 tokens on average
    // Add extra tokens for special characters
    return Math.ceil(words * 1.3 + specialChars * 0.5);
}



/**
 * Split text into chunks based on natural boundaries
 * @param {string} text - Text to split
 * @param {Object} options - Chunking options
 * @param {number} options.maxTokens - Maximum tokens per chunk
 * @param {number} options.minTokens - Minimum tokens per chunk
 * @returns {string[]} Array of text chunks
 */
export function splitIntoChunks(text, { maxTokens, minTokens }) {
    if (!text) return [];
    
    // First split into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
        // If paragraph itself is too big, split into sentences
        if (estimateTokenCount(paragraph) > maxTokens) {
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
            
            for (const sentence of sentences) {
                const newChunk = currentChunk + (currentChunk ? '\n' : '') + sentence;
                const tokenCount = estimateTokenCount(newChunk);
                
                if (tokenCount > maxTokens && currentChunk) {
                    if (estimateTokenCount(currentChunk) >= minTokens) {
                        chunks.push(currentChunk.trim());
                    }
                    currentChunk = sentence;
                } else {
                    currentChunk = newChunk;
                }
            }
        } else {
            // Try to add whole paragraph
            const newChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
            const tokenCount = estimateTokenCount(newChunk);
            
            if (tokenCount > maxTokens && currentChunk) {
                if (estimateTokenCount(currentChunk) >= minTokens) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = paragraph;
            } else {
                currentChunk = newChunk;
            }
        }
    }
    
    // Add final chunk if it meets minimum size
    if (currentChunk && estimateTokenCount(currentChunk) >= minTokens) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}
