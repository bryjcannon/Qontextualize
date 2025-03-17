import { determineClaimAgreement } from '../video_claim_analysis.js';
import { fetchScholarResults } from './searchSources.js';
import { processStudies } from './formatSourceResults.js';
import { generateReportObject } from './generateSourceReport.js';

/**
 * Process a single claim and find relevant sources
 * @param {string} claim - The claim text to analyze
 * @returns {Promise<Array>} Array of sources for the claim
 */
async function claimSourceRunner(claim) {
    try {
        console.log('Searching sources for claim:', claim);
        const sources = await fetchScholarResults(claim);
        
        if (sources.length === 0) {
            console.log('No sources found for claim:', claim);
            return [];
        }
        
        console.log(`Found ${sources.length} sources for claim:`, claim);
        console.log('First source:', sources[0]);
        
        const formattedData = await processStudies(claim, sources);
        const reportData = generateReportObject(claim, formattedData);
        
        // Return the formatted source titles with links
        return sources.map(source => 
            source.link ? `<a href="${source.link}" target="_blank">${source.title}</a>` : source.title
        );
    } catch (error) {
        console.error('Error in claimSourceRunner:', error);
        return [];
    }
}

/**
 * Process a list of claims, integrating source information and agreement status
 * @param {string} claimsText - Raw claims text
 * @param {Object} verifiedClaims - Object containing verification data for each claim
 * @returns {Promise<Array>} Array of processed claims with sources and agreement status
 */
async function processClaimsWithSources(claimsText, verifiedClaims) {
    return Promise.all(
        claimsText.split('\n')
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

                    // Get sources for this claim
                    console.log('Identifying sources...');
                    const claimSources = await claimSourceRunner(claimText);
                    
                    // Analyze agreement
                    const consensusAgreement = determineClaimAgreement(verification.consensus);
                    const assessmentAgreement = determineClaimAgreement(verification.assessment);
                    
                    // Use most definitive agreement status
                    const agreementStatus = 
                        consensusAgreement === 'disagrees' || assessmentAgreement === 'disagrees' ? 'disagrees' :
                        consensusAgreement === 'agrees' || assessmentAgreement === 'agrees' ? 'agrees' : 'neutral';

                    // Apply color based on agreement
                    const colors = {
                        'agrees': '#2ecc71',     // Bright green
                        'disagrees': '#e74c3c',  // Bright red
                        'neutral': '#ffffff'     // White
                    };

                    return {
                        title: topic,
                        summary: claimText.trim(),
                        consensus: verification.consensus,
                        assessment: verification.assessment,
                        color: colors[agreementStatus],
                        agreementStatus,
                        sources: claimSources.map(source => source.title)
                    };
                } catch (error) {
                    console.error(`Error processing claim '${topic}':`, error);
                    return {
                        title: topic,
                        summary: claimText.trim(),
                        consensus: 'Error: Could not verify scientific consensus',
                        assessment: 'Error: Could not fully analyze this claim',
                        color: '#ffffff',
                        agreementStatus: 'neutral',
                        sources: []
                    };
                }
            })
    );
}

export { processClaimsWithSources, claimSourceRunner };

