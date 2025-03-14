import { OpenAI } from 'openai';
import { prompts } from './prompts.js';
import { extractClaims, verifyClaims, extractTimestamps, fetchSources, generateChunkSummaries, generateFinalSummary } from './video_claim_analysis.js';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateFinalReport(transcript) {
    try {
        console.log('Extracting claims...');
        const claims = await extractClaims(transcript);
        
        console.log('Verifying claims...');
        const verifiedClaims = await verifyClaims(claims);
        
        // Generate summaries first since we want them regardless of claims
        const chunkSummaries = await generateChunkSummaries(transcript);
        const summary = await generateFinalSummary(chunkSummaries);

        // If no claims were found or verified, return early with just the summary
        if (!verifiedClaims || verifiedClaims.length === 0) {
            return {
                summary,
                claims: [],
                message: "No strong or potentially controversial claims were identified in this video."
            };
        }
        
        // console.log('Finding timestamps...');
        // const timestamps = extractTimestamps(transcript, claims);
        
        const claimsList = claims.split('\n').filter(claim => claim.trim());
        let processedClaims = [];
        

        
        // Fetch sources for all claims
        console.log('Fetching scientific sources...');
        const allSources = await fetchSources(claims);

        // Process all claims in parallel
        const claimPromises = claimsList
            .filter(claim => claim.includes(':'))
            .map(async claim => {
                const [topic, claimText] = claim.split(':', 2);
                console.log(`Processing claim: ${topic}`);
                
                try {
                    const verification = verifiedClaims[topic] || {
                        confidence: 'Low',
                        assessment: 'Could not verify this claim',
                        evidence: [],
                        consensus: 'Insufficient data to establish scientific consensus'
                    };

                    // Get scientific consensus if not present
                    if (!verification.consensus) {
                        const consensusPrompt = prompts.getConsensus(topic, claimText);
                        const consensusResponse = await openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [{ role: "user", content: consensusPrompt }]
                        });
                        verification.consensus = consensusResponse.choices[0].message.content;
                    }

                    // Get and analyze sources for this claim
                    console.log(`📓 Processing sources for topic: ${topic}`);
                    
                    const sources = allSources[topic] || [];
                    console.log(`📁 Found ${sources.length} sources for topic`);
                    
                    // Analyze source quality and relevance
                    let sourceAnalysis = '';
                    if (sources.length > 0) {
                        // Count sources by domain and type
                        const domainCounts = {};
                        let peerReviewedCount = 0;
                        let recentSourceCount = 0;
                        const currentYear = new Date().getFullYear();
                        
                        sources.forEach(src => {
                            // Domain counting
                            domainCounts[src.domain] = (domainCounts[src.domain] || 0) + 1;
                            
                            // Peer review counting
                            if (src.isPeerReviewed) peerReviewedCount++;
                            
                            // Recent source counting
                            if (src.publishedDate) {
                                const pubYear = new Date(src.publishedDate).getFullYear();
                                if (currentYear - pubYear <= 3) recentSourceCount++;
                            }
                        });
                        
                        // Format domain information
                        const topDomains = Object.entries(domainCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([domain, count]) => `${domain} (${count})`)
                            .join(', ');
                        
                        // Build source analysis
                        sourceAnalysis = `\n\nThis assessment is supported by ${sources.length} scientific sources`;
                        
                        if (peerReviewedCount > 0) {
                            sourceAnalysis += `, including ${peerReviewedCount} peer-reviewed publication${peerReviewedCount > 1 ? 's' : ''}`;
                        }
                        
                        if (recentSourceCount > 0) {
                            sourceAnalysis += `, with ${recentSourceCount} source${recentSourceCount > 1 ? 's' : ''} from the past 3 years`;
                        }
                        
                        sourceAnalysis += `. Sources come from ${topDomains}.\n\n`;
                        
                        // Add detailed source information
                        const keySourceInfo = sources.slice(0, 2).map(source => {
                            let info = `${source.title}`;
                            if (source.authors) info += ` by ${source.authors}`;
                            if (source.journal) info += ` (${source.journal})`;
                            if (source.publishedDate) {
                                const date = new Date(source.publishedDate);
                                info += `, ${date.getFullYear()}`;
                            }
                            return info;
                        });
                        
                        if (keySourceInfo.length > 0) {
                            sourceAnalysis += `Key references:\n- ${keySourceInfo.join('\n- ')}`;
                        }
                    }
                    
                    // Enhance assessment with source information
                    const assessment = sources.length === 0
                        ? verification.assessment + '\n\nNote: While this assessment is based on general scientific knowledge, we were unable to find direct scientific sources for this specific claim. Consider consulting additional academic databases or medical professionals for verification.'
                        : verification.assessment + sourceAnalysis;

                    const result = {
                        title: topic,
                        summary: claimText.trim(),
                        timestamps: timestamps[topic] || [],
                        sources: sources,
                        consensus: verification.consensus,
                        assessment: assessment
                    };

                    console.log('📚 Final report section:', {
                        title: result.title,
                        sourcesCount: result.sources.length,
                        hasTimestamps: result.timestamps.length > 0,
                        hasConsensus: !!result.consensus
                    });

                    return result;
                } catch (error) {
                    console.error(`Error processing claim '${topic}':`, error);
                    return {
                        title: topic,
                        summary: claimText.trim(),
                        timestamps: timestamps[topic] || [],
                        sources: allSources[topic] || [],
                        consensus: 'Error: Could not verify scientific consensus',
                        assessment: 'Error: Could not fully analyze this claim'
                    };
                }
            });

        // Wait for all claims to be processed
        processedClaims = await Promise.all(claimPromises);  
        
        return {
            videoTitle: 'Video Analysis',  // This will be set by the frontend
            summary,
            claims: processedClaims
        };
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

export { generateFinalReport };
