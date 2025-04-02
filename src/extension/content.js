// API configuration
const API_BASE_URL = 'https://api.qontextualize.com';

// Function to extract transcript from YouTube page
async function extractTranscript() {
    try {
        // Get video title
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
        if (!videoTitle) {
            throw new Error('Could not find video title');
        }

        // Find and click the "Show transcript" button
        const buttons = Array.from(document.querySelectorAll('button'));
        const transcriptButton = buttons.find(button => button.textContent.includes('Show transcript'));
        
        if (!transcriptButton) {
            throw new Error('Transcript button not found. Make sure you have opened the transcript panel.');
        }
        
        transcriptButton.click();
        
        // Wait for transcript to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get transcript segments
        const transcriptSegments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
        if (!transcriptSegments.length) {
            throw new Error('No transcript segments found');
        }
        
        // Extract text from segments
        const transcriptText = transcriptSegments
            .map(segment => {
                const text = segment.querySelector('#text')?.textContent;
                return text ? text.trim() : '';
            })
            .filter(Boolean)
            .join(' ');
            
        if (!transcriptText) {
            throw new Error('Failed to extract transcript text');
        }

        // Generate storage keys
        const timestamp = Date.now();
        const storageKey = `transcript_${timestamp}`;
        const analysisKey = `analysis_${timestamp}`;

        // Save transcript to storage
        await chrome.storage.local.set({
            [storageKey]: {
                videoTitle,
                transcript: transcriptText,
                timestamp
            }
        });

        // Send transcript for analysis
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transcript: transcriptText })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const analysis = await response.json();

        // Save analysis to storage
        await chrome.storage.local.set({
            [analysisKey]: {
                ...analysis,
                timestamp
            }
        });

        // Send success message back to popup
        chrome.runtime.sendMessage({
            action: 'transcriptExtracted',
            success: true,
            videoTitle,
            storageKey,
            analysisKey
        });

    } catch (error) {
        console.error('Transcript extraction error:', error);
        chrome.runtime.sendMessage({
            action: 'transcriptExtracted',
            success: false,
            error: error.message
        });
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractTranscript') {
        extractTranscript();
    }
});
