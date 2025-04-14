import settingsManager from './src/utils/settings-manager.js';

document.addEventListener('DOMContentLoaded', async function() {
    const button = document.getElementById('qontextualize-btn');
    const downloadBtn = document.getElementById('download-btn');
    const fullReportCheckbox = document.getElementById('full-report-checkbox');
    
    // Initially disable download button
    downloadBtn.disabled = true;
    
    // Initialize settings toggle
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsContent = document.getElementById('settings-content');
    
    // Initialize as collapsed
    settingsToggle.classList.add('collapsed');
    settingsContent.classList.add('collapsed');
    
    // Load settings state from storage
    chrome.storage.local.get('settingsExpanded', ({ settingsExpanded }) => {
        if (settingsExpanded === true) {
            settingsToggle.classList.remove('collapsed');
            settingsContent.classList.remove('collapsed');
        }
    });
    
    settingsToggle.addEventListener('click', () => {
        const isCollapsed = settingsToggle.classList.toggle('collapsed');
        settingsContent.classList.toggle('collapsed');
        // Save state
        chrome.storage.local.set({ settingsExpanded: !isCollapsed });
    });
    
    // Initialize settings
    const saveLocalDataCheckbox = document.getElementById('save-local-data');
    const isLocalDataEnabled = await settingsManager.isLocalDataSavingEnabled();
    saveLocalDataCheckbox.checked = isLocalDataEnabled;
    
    saveLocalDataCheckbox.addEventListener('change', async (event) => {
        try {
            await settingsManager.updateSetting('saveLocalData', event.target.checked);
        } catch (error) {
            console.error('Failed to save setting:', error);
            // Revert checkbox state
            event.target.checked = !event.target.checked;
        }
    });
    
    // Get list of all stored transcripts
    const stored = await chrome.storage.local.get(null);
    const transcripts = Object.entries(stored)
        .filter(([key]) => key.startsWith('transcript_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

    if (transcripts.length > 0) {
        downloadBtn.disabled = false;
    }

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'transcriptExtracted') {
            if (!message.success) {
                button.style.backgroundColor = '#ff3333'; // Red for error
            } else {
                downloadBtn.disabled = false;

                // Open transcript viewer in new tab with both keys
                const viewerURL = chrome.runtime.getURL('transcript.html') + 
                    `?transcriptKey=${message.storageKey}&analysisKey=${message.analysisKey}`;
                chrome.tabs.create({ url: viewerURL });
            }
            
            // Revert button color after 1 second
            setTimeout(() => {
                button.classList.remove('clicked');
                button.style.backgroundColor = ''; // Reset to default blue
            }, 1000);
        }
    });

    // Save checkbox state to storage
    fullReportCheckbox.addEventListener('change', function() {
        chrome.storage.local.set({ 'fullReportEnabled': this.checked });
    });

    // Load checkbox state from storage
    chrome.storage.local.get('fullReportEnabled', function(data) {
        fullReportCheckbox.checked = !!data.fullReportEnabled;
    });

    button.addEventListener('click', async function() {
        // Change button color to green
        button.classList.add('clicked');

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
        } catch (error) {
            console.error('Error downloading transcript:', error);
        }
    });
});
