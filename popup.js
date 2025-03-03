document.addEventListener('DOMContentLoaded', async function() {
    const button = document.getElementById('qontextualize-btn');
    const downloadBtn = document.getElementById('download-btn');
    const statusText = document.getElementById('status');
    
    // Initially disable download button
    downloadBtn.disabled = true;
    
    // Get list of all stored transcripts
    const stored = await chrome.storage.local.get(null);
    const transcripts = Object.entries(stored)
        .filter(([key]) => key.startsWith('transcript_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

    if (transcripts.length > 0) {
        const [key, latestTranscript] = transcripts[0];
        const { videoTitle, timestamp } = latestTranscript;
        const date = new Date(timestamp).toLocaleTimeString();
        statusText.textContent = `Last transcript: ${videoTitle} (${date})`;
        statusText.classList.add('success');
        downloadBtn.disabled = false;
    }

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'transcriptExtracted') {
            if (!message.success) {
                button.style.backgroundColor = '#ff3333'; // Red for error
                statusText.textContent = `Error: ${message.error}`;
                statusText.classList.add('error');
            } else {
                statusText.textContent = `Stored transcript: ${message.videoTitle}`;
                statusText.classList.add('success');
                downloadBtn.disabled = false;

                // Open transcript viewer in new tab with both keys
                const viewerURL = chrome.runtime.getURL('transcript.html') + 
                    `?transcriptKey=${message.storageKey}&summaryKey=${message.summaryKey}`;
                chrome.tabs.create({ url: viewerURL });
            }
            
            // Revert button color after 1 second
            setTimeout(() => {
                button.classList.remove('clicked');
                button.style.backgroundColor = ''; // Reset to default blue
            }, 1000);
        }
    });

    button.addEventListener('click', async function() {
        // Change button color to green
        button.classList.add('clicked');
        statusText.textContent = 'Extracting transcript...';
        statusText.classList.remove('success', 'error');

        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Inject and execute content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Send message to content script to extract transcript
            chrome.tabs.sendMessage(tab.id, { action: 'extractTranscript' });
        } catch (error) {
            console.error('Error:', error);
            button.style.backgroundColor = '#ff3333'; // Red for error
            statusText.textContent = `Error: ${error.message}`;
            statusText.classList.add('error');
            
            setTimeout(() => {
                button.classList.remove('clicked');
                button.style.backgroundColor = ''; // Reset to default blue
            }, 1000);
        }
    });

    // Download button click handler
    downloadBtn.addEventListener('click', async function() {
        try {
            // Get latest transcript
            const stored = await chrome.storage.local.get(null);
            const transcripts = Object.entries(stored)
                .filter(([key]) => key.startsWith('transcript_'))
                .sort((a, b) => b[1].timestamp - a[1].timestamp);

            if (transcripts.length === 0) {
                throw new Error('No transcript available');
            }

            // Format transcript for download
            const [key, latestTranscript] = transcripts[0];
            const { segments, videoTitle } = latestTranscript;
            let transcriptText = '';
            segments.forEach(segment => {
                transcriptText += `${segment.timestamp} ${segment.text}\n`;
            });

            // Create and trigger download
            const blob = new Blob([transcriptText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`;
            a.click();
            URL.revokeObjectURL(url);

            // Show success message
            statusText.textContent = 'Transcript downloaded!';
            statusText.classList.add('success');
        } catch (error) {
            console.error('Error downloading transcript:', error);
            statusText.textContent = `Error: ${error.message}`;
            statusText.classList.add('error');
        }
    });
});
