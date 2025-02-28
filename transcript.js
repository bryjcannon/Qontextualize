document.addEventListener('DOMContentLoaded', async function() {
    // Get transcript data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const transcriptKey = urlParams.get('key');
    
    if (!transcriptKey) {
        document.getElementById('video-title').textContent = 'Error: No transcript key provided';
        return;
    }

    try {
        // Get transcript from chrome.storage
        const result = await chrome.storage.local.get(transcriptKey);
        const transcriptData = result[transcriptKey];
        
        if (!transcriptData) {
            throw new Error('Transcript not found');
        }

        // Update title
        document.getElementById('video-title').textContent = transcriptData.videoTitle;
        
        // Create transcript content
        const transcriptContainer = document.getElementById('transcript-content');
        transcriptData.segments.forEach(segment => {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'segment';
            
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'timestamp';
            timestampDiv.textContent = segment.timestamp;
            
            const textDiv = document.createElement('div');
            textDiv.className = 'text';
            textDiv.textContent = segment.text;
            
            segmentDiv.appendChild(timestampDiv);
            segmentDiv.appendChild(textDiv);
            transcriptContainer.appendChild(segmentDiv);
        });
    } catch (error) {
        document.getElementById('video-title').textContent = `Error: ${error.message}`;
        document.getElementById('transcript-content').textContent = 'Failed to load transcript';
    }
});
