import OpenAIService from './openai-service.js';

async function generateAndStoreSummary(transcriptData, summaryKey) {
    try {
        // Initialize OpenAI service
        const openai = new OpenAIService();

        // Generate summary
        const summary = await openai.summarizeTranscript(transcriptData.fullText);

        // Store summary
        await chrome.storage.local.set({
            [summaryKey]: {
                summary,
                timestamp: Date.now()
            }
        });

        return summary;
    } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Get transcript data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const transcriptKey = urlParams.get('transcriptKey');
    const summaryKey = urlParams.get('summaryKey');
    
    if (!transcriptKey || !summaryKey) {
        document.getElementById('video-title').textContent = 'Error: Missing required parameters';
        return;
    }

    try {
        // Validate key formats
        if (!transcriptKey.startsWith('transcript_') || !summaryKey.startsWith('summary_')) {
            throw new Error('Invalid key format');
        }

        // Get transcript and existing summary from chrome.storage
        const result = await chrome.storage.local.get([transcriptKey, summaryKey]);
        const transcriptData = result[transcriptKey];
        let summaryData = result[summaryKey];
        
        if (!transcriptData) {
            throw new Error('Transcript not found');
        }

        // Update summary section
        const summaryContent = document.getElementById('summary-content');
        
        if (!summaryData) {
            // Generate new summary
            summaryContent.innerHTML = '<p>Generating summary...</p>';
            try {
                const summary = await generateAndStoreSummary(transcriptData, summaryKey);
                summaryContent.innerHTML = `<p>${summary}</p>`;
            } catch (error) {
                summaryContent.innerHTML = `<p>Error generating summary: ${error.message}</p>`;
            }
        } else {
            // Use existing summary
            summaryContent.innerHTML = `<p>${summaryData.summary}</p>`;
        }

        // Update title
        document.getElementById('video-title').textContent = transcriptData.videoTitle;
        

    } catch (error) {
        document.getElementById('video-title').textContent = `Error: ${error.message}`;
        document.getElementById('summary-content').innerHTML = '<p>Failed to load content</p>';
    }
});
