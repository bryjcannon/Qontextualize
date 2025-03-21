import { prompts } from '../prompts/prompts.js';
import { processTranscript, verifyClaims, determineClaimAgreement, fetchSources } from './video_claim_analysis.js';
import openaiService from './openai-service.js';
import { config } from '../config/index.js';

async function generateFinalReport(transcript) {
    try {
        // Process transcript to get claims and summary
        const { claims, finalSummaryResponse } = await processTranscript(transcript);
        
        console.log('Verifying claims...');
        const verifiedClaims = await verifyClaims(claims);

        // If no claims were found or verified, return early with just the summary
        if (!verifiedClaims || verifiedClaims.length === 0) {
            return {
                summary: finalSummaryResponse,
                claims: [],
                message: "No strong or potentially controversial claims were identified in this video."
            };
        }
        


        // Process all claims in parallel
        console.log('Processing claims...');
        let processedClaims = await Promise.all(
            claims.split('\n')
                .filter(claim => claim.trim() && claim.includes(':'))
                .map(async claim => {
                    const [topic, claimText] = claim.split(':', 2);
                    
                    // Skip claims with empty or very short text
                    const words = claimText.trim().split(/\s+/);
                    if (words.length < config.claims.minClaimLength) {
                        console.log(`Skipping claim '${topic}' due to insufficient length (${words.length} words)`);
                        return null;
                    }
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
                            verification.consensus = await openaiService.analyzeContent(consensusPrompt);
                        }

                        // Get and analyze sources for this claim
                        console.log(`📓 Processing sources for topic: ${topic}`);
                        const sources = await fetchSources(claimText.trim());
                        console.log(`📁 Found ${sources.length} sources for topic`);
                        
                        // Analyze source quality and relevance
                        let sourceAnalysis = '';
                        if (sources.length > 0) {
                            const currentYear = new Date().getFullYear();
                            const domainCounts = {};
                            let peerReviewedCount = 0;
                            let recentSourceCount = 0;
                            
                            sources.forEach(src => {
                                domainCounts[src.domain] = (domainCounts[src.domain] || 0) + 1;
                                if (src.isPeerReviewed) peerReviewedCount++;
                                if (src.publishedDate) {
                                    const pubYear = new Date(src.publishedDate).getFullYear();
                                    if (currentYear - pubYear <= config.claims.recentSourceYears) recentSourceCount++;
                                }
                            });
                            
                            const topDomains = Object.entries(domainCounts)
                                .sort((a, b) => b[1] - a[1])
                                .map(([domain, count]) => `${domain} (${count})`)
                                .join(', ');
                            
                            sourceAnalysis = `\n\nThis assessment is supported by ${sources.length} scientific sources`
                                + (peerReviewedCount > 0 ? `, including ${peerReviewedCount} peer-reviewed publication${peerReviewedCount > 1 ? 's' : ''}` : '')
                                + (recentSourceCount > 0 ? `, with ${recentSourceCount} source${recentSourceCount > 1 ? 's' : ''} from the past 3 years` : '')
                                + `. Sources come from ${topDomains}.\n\n`;
                            
                            const keySourceInfo = sources.slice(0, 2).map(source => {
                                let info = `${source.title}`;
                                if (source.authors) info += ` by ${source.authors}`;
                                if (source.journal) info += ` (${source.journal})`;
                                if (source.publishedDate) info += `, ${new Date(source.publishedDate).getFullYear()}`;
                                return info;
                            });
                            
                            if (keySourceInfo.length > 0) {
                                sourceAnalysis += `Key references:\n- ${keySourceInfo.join('\n- ')}`;
                            }
                        }
                        
                        const assessment = sources.length === 0
                            ? verification.assessment + '\n\nNote: While this assessment is based on general scientific knowledge, we were unable to find direct scientific sources for this specific claim. Consider consulting additional academic databases or medical professionals for verification.'
                            : verification.assessment;

                        // Get the agreement status from the verification object
                        const agreementStatus = determineClaimAgreement(verification);
                        
                        // Force the status to be one of our three values
                        if (!['Support', 'Oppose', 'Neutral'].includes(agreementStatus)) {
                            console.warn('Invalid agreement status detected:', agreementStatus);
                            agreementStatus = 'Neutral';
                        }

                        // Apply color based on agreement
                        const colors = {
                            'Support': '#2ecc71',     // Bright green
                            'Oppose': '#e74c3c',  // Bright red
                            'Neutral': '#ffffff'     // White
                        };
                        const color = colors[agreementStatus];

                        const result = {
                            title: topic,
                            summary: claimText.trim(),
                            sources,
                            consensus: verification.consensus,
                            assessment,
                            color,
                            agreementStatus
                        };

                        console.log('📚 Final report section:', {
                            title: result.title,
                            sourcesCount: sources.length,

                            hasConsensus: !!result.consensus,
                            agreementStatus: result.agreementStatus,
                            color: result.color
                        });

                        return result;
                    } catch (error) {
                        console.error(`Error processing claim '${topic}':`, error);
                        // Return null for error cases to be consistent with our filtering
                        return null;
                    }
                })
        );

        // Filter out null claims (those that were too short)
        processedClaims = processedClaims.filter(claim => claim !== null);
        
        return {
            videoTitle: 'Video Analysis',  // This will be set by the frontend
            summary: finalSummaryResponse,
            claims: processedClaims
        };
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

export { generateFinalReport };
