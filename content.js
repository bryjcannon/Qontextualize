import browserStorageService from './src/services/browser-storage-service.js';

console.log('Qontextualize extension loaded on YouTube video page');

// Function to parse timestamp to seconds
function parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) { // MM:SS
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) { // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

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

        // Format transcript data for storage
        const transcriptFormatted = {
            videoTitle,
            transcript: transcriptData.map(segment => ({
                start: parseTimestamp(segment.timestamp),
                end: parseTimestamp(segment.timestamp) + 5, // Approximate 5-second segments
                text: segment.text
            }))
        };

        // Save to browser storage service
        try {
            const { transcriptKey, analysisKey } = await browserStorageService.saveTranscript(
                window.location.href,
                transcriptFormatted
            );

            // Update popup with success
            chrome.runtime.sendMessage({
                action: 'transcriptSaved',
                transcriptKey,
                analysisKey
            });
        } catch (error) {
            console.error('Error saving transcript:', error);
            chrome.runtime.sendMessage({
                action: 'error',
                message: error.message
            });
        }
    } catch (error) {
        console.error('Error extracting transcript:', error);
        chrome.runtime.sendMessage({
            action: 'error',
            message: error.message
        });
    }

    } catch (error) {
        console.error('Error extracting transcript:', error);
        chrome.runtime.sendMessage({
            action: 'error',
            message: error.message
        });
    }

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
