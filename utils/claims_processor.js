import OpenAI from 'openai';
import { prompts } from '../prompts.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Calculates cosine similarity between two embeddings
 */
function cosineSimilarity(embedding1, embedding2) {
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    const norm1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (norm1 * norm2);
}

/**
 * Clusters claims based on semantic similarity
 */
async function clusterClaims(claims) {
    // Get embeddings for all claims
    const embeddings = await Promise.all(claims.map(async claim => {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: claim
        });
        return response.data[0].embedding;
    }));

    // Build similarity matrix
    const similarityMatrix = embeddings.map(emb1 => 
        embeddings.map(emb2 => cosineSimilarity(emb1, emb2))
    );

    // Cluster claims using hierarchical clustering
    const clusters = [];
    const used = new Set();
    const similarityThreshold = 0.95;

    for (let i = 0; i < claims.length; i++) {
        if (used.has(i)) continue;

        const cluster = [i];
        used.add(i);

        for (let j = i + 1; j < claims.length; j++) {
            if (used.has(j)) continue;
            if (similarityMatrix[i][j] > similarityThreshold) {
                cluster.push(j);
                used.add(j);
            }
        }

        clusters.push(cluster.map(idx => claims[idx]));
    }

    // Select representative claim from each cluster
    return clusters.map(cluster => cluster[0]);
}

/**
 * Scores claims based on importance and confidence
 */
async function scoreClaims(claims) {
    const scorePrompt = `Rate the following scientific claim on a scale of 1-10 based on:
- Importance (scientific significance)
- Specificity (concrete vs vague)
- Verifiability (can be fact-checked)
- Confidence (strength of the claim)

Claim: {claim}

Return only a number 1-10.`;

    const scores = await Promise.all(claims.map(async claim => {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ 
                role: "user", 
                content: scorePrompt.replace("{claim}", claim)
            }],
            temperature: 0.3
        });
        return parseFloat(response.choices[0].message.content);
    }));

    return claims.map((claim, i) => ({
        claim,
        score: scores[i]
    })).sort((a, b) => b.score - a.score);
}

/**
 * Filters out low-confidence or problematic claims
 */
async function filterClaims(claims) {
    const filterPrompt = `You are an expert in scientific fact-checking. Analyze this claim:
{claim}

Determine if this claim should be included in fact-checking based on:
1. Is it a concrete statement about science, health, technology, or public policy?
2. Does it make specific assertions that can be analyzed (even if controversial or uncertain)?
3. Is it clear and unambiguous?

Return YES if it meets either criteria, even if the claim seems controversial, uncertain, or challenges mainstream views. We want to include important claims that need verification, not just obvious facts. Return NO only if the claim is completely abstract, personal opinion, or impossible to analyze.`;

    const results = await Promise.all(claims.map(async claim => {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ 
                role: "user", 
                content: filterPrompt.replace("{claim}", claim)
            }],
            temperature: 0.1
        });
        return response.choices[0].message.content.toLowerCase().includes("yes");
    }));

    return claims.filter((_, i) => results[i]);
}

/**
 * Uses the elbow method to find optimal number of claims
 */
function findOptimalClaimCount(scoredClaims) {
    const scores = scoredClaims.map(c => c.score);
    const maxClaims = Math.min(20, scores.length); // Cap at 10 claims
    
    // Calculate score differences
    const diffs = [];
    for (let i = 1; i < scores.length; i++) {
        diffs.push(scores[i-1] - scores[i]);
    }
    
    // Find elbow point (significant drop in scores)
    let elbowPoint = 3; // Minimum claims
    for (let i = 3; i < maxClaims; i++) {
        if (diffs[i] < 0.25) { // Threshold for significant difference
            elbowPoint = i;
            break;
        }
    }
    
    return Math.min(elbowPoint, maxClaims);
}

/**
 * Main pipeline for processing claims
 */
export async function processClaims(rawClaims) {
    console.log(`Starting claims processing pipeline with ${rawClaims.length} claims...`);

    // Step 1: Filter out low-quality claims
    console.log("Filtering claims...");
    const filteredClaims = await filterClaims(rawClaims);
    console.log(`Filtered to ${filteredClaims.length} quality claims`);

    // Step 2: Cluster similar claims
    console.log("Clustering similar claims...");
    const uniqueClaims = await clusterClaims(filteredClaims);
    console.log(`Clustered to ${uniqueClaims.length} unique claims`);

    // Step 3: Score remaining claims
    console.log("Scoring claims...");
    const scoredClaims = await scoreClaims(uniqueClaims);
    
    // Step 4: Find optimal number of claims
    const optimalCount = findOptimalClaimCount(scoredClaims);
    console.log(`Selected optimal number of claims: ${optimalCount}`);

    // Return top N claims
    const finalClaims = scoredClaims
        .slice(0, optimalCount)
        .map(c => c.claim);

    return {
        originalCount: rawClaims.length,
        filteredCount: filteredClaims.length,
        uniqueCount: uniqueClaims.length,
        finalCount: finalClaims.length,
        claims: finalClaims,
        scores: scoredClaims.slice(0, optimalCount)
    };
}
