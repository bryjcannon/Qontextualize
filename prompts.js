// OpenAI prompts for video claim analysis
export const prompts = {
    // Extract claims from transcript chunks
    extractClaims: (chunk) => `Given the following transcript:
${chunk}
You are an AI expert in scientific fact-checking. Identify strong claims, especially scientific or technical in nature, using TF-IDF & NLP techniques. List each claim separately along with any sources mentioned. Format each claim as: "[Topic]: [Claim statement]".`,

    // Verify individual claims
    verifyClaim: (claim, topic) => `You are an AI expert in scientific fact-checking. Analyze this scientific claim:
${claim}

Provide a JSON object with this exact structure (no additional text):
{
  "topic": "${topic}",
  "confidence": "High/Medium/Low",
  "assessment": "brief factual assessment of the claim's accuracy",
  "evidence": ["key evidence point 1", "key evidence point 2"],
  "consensus": "current scientific consensus on this topic"
}`,

    // Generate summary for a transcript chunk
    generateSummary: (chunk) => `You are an expert in scientific communication. Given this portion of a video transcript, create a concise summary that:
1. Identifies the main people involved and their roles
2. Identifies the main scientific topics and themes
3. Highlights key scientific claims and findings discussed
4. Notes any significant debates or uncertainties mentioned
5. Maintains scientific accuracy and objectivity

Transcript Portion:
${chunk}

Provide a clear, factual summary in 2-3 sentences that captures the key information from this portion.`,

    // Generate final summary from chunk summaries
    generateFinalSummary: (chunkSummaries) => `You are an expert in scientific communication. Below are summaries of different portions of a video transcript. Create a comprehensive final summary that:
1. Synthesizes the key points from all portions
2. Identifies the main people involved and their roles
3. Presents the main scientific topics and themes
4. Highlights the most significant claims and findings
5. Notes any important debates or uncertainties
6. Maintains scientific accuracy and objectivity

Chunk Summaries:
${chunkSummaries}

Provide a clear, well-organized summary in 3-4 sentences that gives a complete picture of the video's content.`,

    // Get scientific consensus for a topic
    getConsensus: (topic, claimText) => `What is the current scientific consensus regarding: ${topic} ${claimText}
Provide a brief, factual response based on current scientific understanding.`,

    // Get scientific sources for claims
    getSources: (claim) => `You are a research assistant specialized in finding credible scientific publications. Analyze this claim: "${claim}"

Identify up to 5 relevant scientific publications that address this claim. Include both supporting and opposing evidence if available. For each source:

Required:
- Title (exact publication title)
- Summary (2-3 sentences about key findings)
- Stance ("Support", "Oppose", or "Neutral")
- URL (direct link to the publication)

Optional if available:
- Authors (main authors)
- Journal (publication venue)
- Year (publication year)
- Citations (approximate citation count)

Provide your response in this exact JSON format:
{
    "claim": "${claim}",
    "sources": [
        {
            "title": "Full Publication Title",
            "summary": "2-3 sentence summary of key findings",
            "stance": "Support/Oppose/Neutral",
            "url": "direct_url_to_publication",
            "authors": "Author names",
            "journal": "Journal or Conference name",
            "year": "YYYY",
            "citations": number
        }
    ]
}

Important:
- Focus on peer-reviewed scientific publications when possible
- Include both supporting and opposing viewpoints if they exist
- Ensure URLs point to the actual publication (no Wikipedia)
- Must return valid JSON that exactly matches the schema
- Be precise about stance - use only "Support", "Oppose", or "Neutral"
- If you're unsure about optional fields, omit them rather than guess`
};
