import openaiService from '../services/openai-service.js';
import { config } from '../config/index.js';

/**
 * Score a claim based on misinformation potential, ethics, and controversy
 * @param {string} claim - The claim to score
 * @returns {Promise<number>} Score between 1-10
 */
async function scoreClaimRisk(claim) {
    const scorePrompt = `Rate the following scientific claim on a scale of 1 (low match) to 10 (high match) based on:
- Potential for Misinformation (Does the claim have a high likelihood of being misinterpreted?)
- Ethical Considerations (Does the claim pose ethical risks or concerns?)
- Controversy Level (How controversial or contentious is the claim?)

Claim: ${claim}

Return only a number 1-10.`;

    const result = await openaiService.analyzeContent(scorePrompt);
    return parseFloat(result);
}

/**
 * Score a list of claims and sort by risk score
 * @param {string[]} claims - List of claims to score
 * @returns {Promise<Array<{claim: string, score: number}>>} Scored and sorted claims
 */
async function scoreClaims(claims) {
    const scores = await Promise.all(claims.map(scoreClaimRisk));
    
    return claims
        .map((claim, i) => ({ claim, score: scores[i] }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Get embeddings for claims using OpenAI's API
 * @param {string[]} claims - List of claims to get embeddings for
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function getEmbeddings(claims) {
    const embeddings = await Promise.all(claims.map(async claim => {
        return await openaiService.getEmbedding(claim);
    }));
    return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1, vec2) {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (norm1 * norm2);
}

/**
 * Group claims into clusters using K-means
 * @param {string[]} claims - List of claims to cluster
 * @returns {Promise<Object<string, string>>} Cluster summaries with top scored claims
 */
export async function clusterClaims(claims) {
    if (!claims?.length) return {};

    // Get embeddings for all claims
    const embeddings = await getEmbeddings(claims);
    
    // Build similarity matrix
    const similarityMatrix = embeddings.map(emb1 => 
        embeddings.map(emb2 => cosineSimilarity(emb1, emb2))
    );

    // Cluster claims using similarity threshold
    const similarityThreshold = config.claims.similarityThreshold;
    const used = new Set();
    const clusters = [];

    // Find clusters
    for (let i = 0; i < claims.length; i++) {
        if (used.has(i)) continue;

        const cluster = [i];
        used.add(i);

        // Find similar claims
        for (let j = i + 1; j < claims.length; j++) {
            if (used.has(j)) continue;
            if (similarityMatrix[i][j] > similarityThreshold) {
                cluster.push(j);
                used.add(j);
            }
        }

        clusters.push(cluster);
    }

    // Convert to clustered claims format
    const clusteredClaims = clusters.reduce((groups, cluster, index) => {
        const clusterName = `Cluster ${index + 1}`;
        groups[clusterName] = cluster.map(idx => claims[idx]);
        return groups;
    }, {});

    // Score and summarize each cluster
    const summaries = {};
    for (const [cluster, clusterClaims] of Object.entries(clusteredClaims)) {
        const scoredClaims = await scoreClaims(clusterClaims);
        const topClaims = scoredClaims
            .slice(0, 3)
            .map(({claim, score}) => `[Risk Score: ${score.toFixed(1)}] ${claim}`)
            .join("\n");
        
        summaries[cluster] = topClaims;
    }

    return summaries;
}

export { scoreClaims, scoreClaimRisk };
