/**
 * Generate a report object summarizing the source analysis for a claim
 * @param {string} claim - The claim being analyzed
 * @param {Array} studies - Array of study objects with stance and metadata
 * @returns {Object} Report object with analysis summary
 */
export function generateReportObject(claim, studies) {
    if (!studies || studies.length === 0) {
        return {
            claim: claim,
            sources_found: 0,
            consensus_score: '0.00',
            consensus_strength: 'No Sources Found',
            most_reliable_study: null,
            supporting: 0,
            refuting: 0,
            neutral: 0,
            summary: ['No academic sources were found for this claim.']
        };
    }

    const totalStudies = studies.length;
    const supporting = studies.filter(s => s.stance === 'support').length;
    const refuting = studies.filter(s => s.stance === 'refute').length;
    const neutral = studies.filter(s => s.stance === 'neutral').length;
    const consensusScore = totalStudies > 0 ? supporting / totalStudies : 0;
    const mostReliableStudy = studies.reduce((max, study) => (study.score > (max?.score || 0) ? study : max), null);

    return {
        claim: claim,
        sources_found: totalStudies,
        consensus_score: consensusScore.toFixed(2),
        consensus_strength: consensusScore > 0.8 ? 'Strong Support' : consensusScore > 0.5 ? 'Moderate Support' : 'Weak Support',
        most_reliable_study: mostReliableStudy ? {
            title: mostReliableStudy.title,
            year: mostReliableStudy.year,
            link: mostReliableStudy.link
        } : null,
        supporting,
        refuting,
        neutral,
        summary: [
            `Found ${totalStudies} relevant academic sources.`,
            supporting > 0 ? `${supporting} studies support the claim.` : null,
            refuting > 0 ? `${refuting} studies refute the claim.` : null,
            neutral > 0 ? `${neutral} studies were inconclusive.` : null,
            mostReliableStudy ? `Most cited study: ${mostReliableStudy.title}` : null
        ].filter(Boolean)
    };
}
