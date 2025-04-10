/**
 * Centralized service for claims processing
 */

import { prompts } from '../prompts/prompts.js';
import openaiService from './openai-service.js';
import { getEmbeddings } from '../utils/cluster_claims.js';
import { tryCatch, ErrorTypes } from '../utils/error-handler.js';

class ClaimsService {
    constructor() {
        // Cache for embeddings to avoid recomputing
        this.embeddingsCache = new Map();
    }

    /**
     * Process a batch of claims through the entire pipeline
     * @param {string[]} rawClaims - Raw claims to process
     * @returns {Promise<Object>} Processed claims with scores and clusters
     */
    async processClaims(rawClaims) {
        return tryCatch(async () => {
            // Step 1: Filter and deduplicate claims
            const uniqueClaims = await this.filterAndDeduplicate(rawClaims);
            
            // Step 2: Get embeddings (cached)
            const embeddings = await this.getClaimEmbeddings(uniqueClaims);
            
            // Step 3: Score and cluster claims
            const scoredClaims = await this.scoreAndClusterClaims(uniqueClaims, embeddings);
            
            return {
                claims: scoredClaims,
                stats: {
                    total: rawClaims.length,
                    unique: uniqueClaims.length,
                    scored: scoredClaims.length
                }
            };
        }, 'processClaims', ErrorTypes.PROCESSING);
    }

    /**
     * Filter and deduplicate claims
     * @private
     */
    async filterAndDeduplicate(claims) {
        const uniqueClaims = new Set();
        const validClaims = [];

        for (const claim of claims) {
            // Basic validation
            if (!claim || typeof claim !== 'string' || claim.length < 10) {
                continue;
            }

            // Normalize claim text
            const normalizedClaim = claim.trim().toLowerCase();
            
            // Skip duplicates
            if (uniqueClaims.has(normalizedClaim)) {
                continue;
            }
            
            // Validate claim quality using OpenAI
            const isValid = await openaiService.analyzeContent(
                prompts.validateClaim(claim),
                { jsonResponse: true }
            );

            if (isValid.isValidClaim) {
                uniqueClaims.add(normalizedClaim);
                validClaims.push(claim);
            }
        }

        return validClaims;
    }

    /**
     * Get embeddings for claims, using cache when possible
     * @private
     */
    async getClaimEmbeddings(claims) {
        const uncachedClaims = claims.filter(claim => !this.embeddingsCache.has(claim));
        
        if (uncachedClaims.length > 0) {
            const newEmbeddings = await getEmbeddings(uncachedClaims);
            
            // Update cache
            uncachedClaims.forEach((claim, i) => {
                this.embeddingsCache.set(claim, newEmbeddings[i]);
            });
        }
        
        return claims.map(claim => this.embeddingsCache.get(claim));
    }

    /**
     * Score and cluster claims using embeddings
     * @private
     */
    async scoreAndClusterClaims(claims, embeddings) {
        // Score claims in parallel
        const scorePromises = claims.map(claim => 
            openaiService.analyzeContent(
                prompts.scoreClaimRisk(claim),
                { jsonResponse: true }
            )
        );
        
        const scores = await Promise.all(scorePromises);
        
        // Combine claims with scores
        const scoredClaims = claims.map((claim, i) => ({
            claim,
            score: scores[i].riskScore,
            embedding: embeddings[i]
        }));
        
        // Sort by risk score
        return scoredClaims.sort((a, b) => b.score - a.score);
    }
}

// Export singleton instance
const claimsService = new ClaimsService();
export default claimsService;
