const axios = require('axios');
const natural = require('natural');
const { OPENAI_API_KEY } = require('./config');

function extractYear(text) {
    const yearMatch = text.match(/\b(20\d{2}|19\d{2})\b/);
    return yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
}

async function classifyStance(text) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4-turbo",
                messages: [{ role: "system", content: "Classify this statement as 'support', 'refute', or 'neutral' regarding the claim: " + text }],
                max_tokens: 10
            },
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" } }
        );

        return response.data.choices[0].message.content.toLowerCase();
    } catch (error) {
        console.error("Error with OpenAI classification:", error);
        return "neutral";
    }
}

function scoreStudy(study) {
    const currentYear = new Date().getFullYear();
    const studyYear = extractYear(study.publication_info.summary || '');
    const yearDifference = currentYear - studyYear;

    const recencyScore = Math.max(0, 1 - (0.02 * yearDifference)); // 2% penalty per year
    const citationCount = study.cited_by ? study.cited_by.value : 0;
    const citationScore = Math.min(1.0, citationCount / 1000); // Capped at 1.0
    const domainScore = study.link.includes("nih.gov") || study.link.includes("nature.com") ? 1.0 : 0.5;
    const articleTypeScore = study.title.toLowerCase().includes("meta-analysis") ? 1.0 :
                             study.title.toLowerCase().includes("RCT") ? 0.8 : 0.5;

    return (0.10 * domainScore) + (0.20 * articleTypeScore) + (0.35 * citationScore) + (0.25 * recencyScore) + (0.10 * 0.7);
}

function detectContradictions(texts) {
    const tfidf = new natural.TfIdf();
    texts.forEach(text => tfidf.addDocument(text));

    let contradictions = 0;
    for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
            const similarity = natural.JaroWinklerDistance(texts[i], texts[j]);
            if (similarity < 0.3) contradictions++;
        }
    }

    return contradictions;
}

async function processStudies(claim, studies) {
    let processedStudies = [];
    for (const study of studies) {
        const score = scoreStudy(study);
        const stance = await classifyStance(study.snippet || '');
        processedStudies.push({
            title: study.title,
            link: study.link,
            score: score,
            stance: stance,
            citation_count: study.cited_by ? study.cited_by.value : 0,
            year: extractYear(study.publication_info.summary || '')
        });
    }

    return processedStudies;
}

module.exports = { processStudies };
