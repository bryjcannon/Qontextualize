import { OpenAI } from 'openai';
import { prompts } from './prompts.js';
import { extractClaims, verifyClaims, generateChunkSummaries, generateFinalSummary, determineClaimAgreement, fetchSources } from './video_claim_analysis.js';
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
        


        // Process all claims in parallel
        console.log('Processing claims...');
        const processedClaims = await Promise.all(
            claims.split('\n')
                .filter(claim => claim.trim() && claim.includes(':'))
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
                                    if (currentYear - pubYear <= 3) recentSourceCount++;
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

                        // Analyze the consensus and assessment for agreement
                        const consensusAgreement = determineClaimAgreement(verification.consensus);
                        const assessmentAgreement = determineClaimAgreement(assessment);
                        
                        console.log('Agreement analysis:', {
                            topic,
                            consensusAgreement,
                            assessmentAgreement,
                            consensusText: verification.consensus,
                            assessmentPreview: assessment.substring(0, 100) + '...'
                        });
                        
                        // Use most definitive agreement status (prefer disagreement over neutral)
                        const agreementStatus = 
                            consensusAgreement === 'disagrees' || assessmentAgreement === 'disagrees' ? 'disagrees' :
                            consensusAgreement === 'agrees' || assessmentAgreement === 'agrees' ? 'agrees' : 'neutral';

                        // Apply color based on agreement
                        const colors = {
                            'agrees': '#2ecc71',     // Bright green
                            'disagrees': '#e74c3c',  // Bright red
                            'neutral': '#ffffff'     // White
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
                        return {
                            title: topic,
                            summary: claimText.trim(),
                            sources: [],
                            consensus: 'Error: Could not verify scientific consensus',
                            assessment: 'Error: Could not fully analyze this claim',
                            color: 'white',
                            agreementStatus: 'neutral'
                        };
                    }
                })
        );
        
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
