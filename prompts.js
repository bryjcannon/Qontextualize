// OpenAI prompts for video claim analysis
export const prompts = {
    // Extract claims from transcript chunks
    extractClaims: (chunk) => `Given the following transcript:
${chunk}
You are an AI expert in scientific fact-checking. Identify strong claims, especially scientific or technical in nature. List each claim separately along with any sources mentioned. Format each claim as: "[Topic]: [Claim statement]".`,

    // Verify individual claims
    verifyClaim: (claim, topic) => `Analyze this scientific claim:
${claim}

Provide a JSON object with this exact structure (no additional text):
{
  "topic": "${topic}",
  "confidence": "High/Medium/Low",
  "assessment": "brief factual assessment of the claim's accuracy",
  "evidence": ["key evidence point 1", "key evidence point 2"],
  "consensus": "current scientific consensus on this topic"
}`,

    // Generate video summary
    generateSummary: (transcript) => `Summarize this transcript in a few sentences focusing on the main topics and scientific claims discussed:
${transcript.slice(0, 2000)}`,

    // Get scientific consensus for a topic
    getConsensus: (topic, claimText) => `What is the current scientific consensus regarding: ${topic} ${claimText}
Provide a brief, factual response based on current scientific understanding.`
};
