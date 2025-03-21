import OpenAI from 'openai';
import { prompts } from '../prompts/prompts.js';
import config from '../config/config.server.js';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

/**
 * Centralized service for handling OpenAI API interactions
 */
class OpenAIService {
    constructor() {
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.defaultModel = "gpt-4-turbo-preview";
        this.maxRetries = config.MAX_RETRIES || 3;
        this.retryDelay = config.RETRY_DELAY || 1000;
    }

    /**
     * Utility method for delayed retry
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generic method to analyze content with OpenAI
     * @param {string} prompt - The prompt to send to OpenAI
     * @param {Object} options - Configuration options
     * @param {string} options.model - OpenAI model to use
     * @param {number} options.temperature - Sampling temperature
     * @param {boolean} options.jsonResponse - Whether to expect JSON response
     * @returns {Promise<string|Object>} The completion response
     */
    async analyzeContent(prompt, options = {}) {
        const {
            model = this.defaultModel,
            temperature = 0.1,
            jsonResponse = false
        } = options;

        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const messages = [{ role: "user", content: prompt }];

                if (jsonResponse) {
                    messages.unshift({
                        role: "system",
                        content: "You are a scientific fact-checker. Always respond with valid JSON matching the exact schema requested."
                    });
                }

                const response = await this.client.chat.completions.create({
                    model,
                    messages,
                    temperature,
                    ...(jsonResponse && { response_format: { type: "json_object" } })
                });

                const content = response.choices[0].message.content;
                return jsonResponse ? JSON.parse(content) : content;
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);
                lastError = error;
                
                if (attempt < this.maxRetries) {
                    await this.sleep(this.retryDelay * attempt);
                }
            }
        }

        throw lastError;
    }

    /**
     * Filter a claim to determine if it should be included in fact-checking
     * @param {string} claim - The claim to filter
     * @returns {Promise<boolean>} Whether the claim should be included
     */
    async filterClaim(claim) {
        const filterPrompt = `You are an expert in scientific fact-checking. Analyze this claim:
${claim}

Determine if this claim should be included in fact-checking based on:
1. Is it a concrete statement about science, health, technology, or public policy?
2. Does it make specific assertions that can be analyzed (even if controversial or uncertain)?
3. Is it clear and unambiguous?

Return YES if it meets either criteria, even if the claim seems controversial, uncertain, or challenges mainstream views. We want to include important claims that need verification, not just obvious facts. Return NO only if the claim is completely abstract, personal opinion, or impossible to analyze.`;

        const response = await this.analyzeContent(filterPrompt);
        return response.toLowerCase().includes("yes");
    }

    /**
     * Verify a claim using OpenAI
     * @param {string} claim - The claim to verify
     * @param {string} topic - The topic of the claim
     * @returns {Promise<Object>} Verification results
     */
    async verifyClaim(claim, topic) {
        const prompt = prompts.verifyClaim(claim, topic);
        
        try {
            return await this.analyzeContent(prompt, { jsonResponse: true });
        } catch (error) {
            console.error(`Error verifying claim '${topic}':`, error);
            return {
                topic,
                confidence: 'Low',
                assessment: 'Error verifying claim',
                evidence: [],
                consensus: 'Unable to verify due to technical error'
            };
        }
    }

    /**
     * Extract claims from a text chunk
     * @param {string} chunk - The text chunk to analyze
     * @returns {Promise<string[]>} Array of extracted claims
     */
    async extractClaims(chunk) {
        const prompt = prompts.extractClaims(chunk);
        const response = await this.analyzeContent(prompt);
        return response.split('\n').filter(claim => claim.trim());
    }

    /**
     * Summarize a transcript using OpenAI
     * @param {string} transcript - The transcript to summarize
     * @returns {Promise<string>} The generated summary
     */
    async summarizeTranscript(transcript) {
        try {
            const response = await fetch(config.PROXY_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `API request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.summary;
        } catch (error) {
            console.error('Error summarizing transcript:', error);
            throw error;
        }
    }
}

// Export singleton instance
const openaiService = new OpenAIService();
export default openaiService;
