const fs = require('fs');
const path = require('path');

function saveToJSON(claim, studies) {
    const totalStudies = studies.length;
    const supporting = studies.filter(s => s.stance === "support").length;
    const refuting = studies.filter(s => s.stance === "refute").length;
    const neutral = studies.filter(s => s.stance === "neutral").length;
    const consensusScore = totalStudies > 0 ? supporting / totalStudies : 0;
    const mostReliableStudy = studies.reduce((max, study) => (study.score > (max?.score || 0) ? study : max), null);

    const reportData = {
        claim: claim,
        sources_found: totalStudies,
        consensus_score: consensusScore.toFixed(2),
        most_reliable_study: mostReliableStudy ? {
            title: mostReliableStudy.title,
            year: mostReliableStudy.year,
            link: mostReliableStudy.link
        } : null,
        supporting: supporting,
        refuting: refuting,
        neutral: neutral
    };

    const outputPath = path.join(__dirname, 'claim_reports.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));

    console.log("Report saved to:", outputPath);
}

module.exports = { saveToJSON };
