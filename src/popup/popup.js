// API configuration
const API_BASE_URL = 'https://api.qontextualize.com';

document.addEventListener('DOMContentLoaded', async function() {
    const button = document.getElementById('qontextualize-btn');
    const statusText = document.getElementById('status');
    
    // Initialize as loading
    button.disabled = true;
    statusText.textContent = 'Loading...';
    
    try {
        // Check if we're on YouTube
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isYouTube = tab?.url?.includes('youtube.com/watch');
        
        if (!isYouTube) {
            statusText.textContent = 'Please navigate to a YouTube video';
            return;
        }
        
        // Enable button
        button.disabled = false;
        statusText.textContent = 'Ready to analyze';
        
        // Handle click
        button.addEventListener('click', async () => {
            try {
                statusText.textContent = 'Extracting transcript...';
                button.disabled = true;
                
                // Inject content script
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.bundle.js']
                });
                
                // Request transcript extraction
                await chrome.tabs.sendMessage(tab.id, { 
                    action: 'extractTranscript'
                });
            } catch (error) {
                console.error('Error:', error);
                statusText.textContent = `Error: ${error.message}`;
                button.disabled = false;
            }
        });
        
    } catch (error) {
        console.error('Initialization error:', error);
        statusText.textContent = `Error: ${error.message}`;
    }
});
