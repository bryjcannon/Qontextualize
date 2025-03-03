console.log('Qontextualize extension loaded on YouTube video page');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractTranscript') {
        extractTranscript();
    }
});

// Function to find and click the transcript button
function findTranscriptButton() {
    return new Promise((resolve) => {
        const checkForButton = () => {
            const button = document.querySelector('button[aria-label*="Show transcript"]');
            if (button) {
                button.click();
                setTimeout(resolve, 1000); // Wait for transcript to load
            } else {
                setTimeout(checkForButton, 500);
            }
        };
        checkForButton();
    });
}

// Function to extract transcript text
async function extractTranscript() {
    try {
        await findTranscriptButton();
        
        // Wait for transcript panel to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const transcriptSegments = document.querySelectorAll('.ytd-transcript-segment-renderer');
        if (transcriptSegments.length === 0) {
            throw new Error('No transcript available');
        }

        // Get video title for storage key
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent || 'Untitled';
        const videoId = new URLSearchParams(window.location.search).get('v') || 'unknown';
        
        // Structure transcript data
        const transcriptData = [];
        transcriptSegments.forEach(segment => {
            const timestamp = segment.querySelector('.segment-timestamp')?.innerText || '';
            const text = segment.querySelector('.segment-text')?.innerText || '';
            transcriptData.push({ timestamp, text });
        });

        const storageKey = `transcript_${videoId}`;
        const summaryKey = `summary_${videoId}`;

        // Format transcript for summarization
        const fullText = transcriptData.map(segment => segment.text).join(' ');

        // Store in chrome.storage.local
        await chrome.storage.local.set({
            [storageKey]: {
                videoId,
                videoTitle,
                timestamp: Date.now(),
                segments: transcriptData,
                fullText
            }
        });

        // Send success message back to popup
        chrome.runtime.sendMessage({ 
            action: 'transcriptExtracted', 
            success: true,
            videoTitle,
            videoId,
            storageKey,
            summaryKey
        });
    } catch (error) {
        console.error('Error extracting transcript:', error);
        chrome.runtime.sendMessage({ 
            action: 'transcriptExtracted', 
            success: false, 
            error: error.message 
        });
    }
}
