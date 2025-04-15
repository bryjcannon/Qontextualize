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

    // Handle button click
    button.addEventListener('click', async function() {
        // Don't process if already processing
        if (button.classList.contains('processing')) {
            return;
        }

        // Show processing state
        button.classList.add('processing');
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url || !tab.url.includes('youtube.com/watch')) {
                alert('Please navigate to a YouTube video first.');
                button.classList.remove('processing');
                return;
            }

            // Execute content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Send message to content script
            chrome.tabs.sendMessage(tab.id, { 
                action: 'getTranscript', 
                fullReport: fullReportCheckbox.checked 
            });
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to process video. Please try again.');
            button.classList.remove('processing');
        }
    });

    // Handle messages from content script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.action === 'openTranscript') {
            if (message.success) {
                // Enable download button
                downloadBtn.disabled = false;
                
                // Open transcript viewer in new tab
                const viewerURL = chrome.runtime.getURL('transcript.html') + 
                    `?transcriptKey=${message.storageKey}&analysisKey=${message.analysisKey}`;
                chrome.tabs.create({ url: viewerURL });
            } else {
                alert(`Failed to get transcript: ${message.error}`);
            }
            
            // Remove processing state
            button.classList.remove('processing');
        }
    });

    // Handle download button
    downloadBtn.addEventListener('click', async function() {
        try {
            // Get latest transcript
            const stored = await chrome.storage.local.get(null);
            const transcripts = Object.entries(stored)
                .filter(([key]) => key.startsWith('transcript_'))
                .sort((a, b) => b[1].timestamp - a[1].timestamp);

            if (transcripts.length === 0) {
                alert('No transcripts available to download.');
                return;
            }

            // Get most recent transcript
            const [key, data] = transcripts[0];
            
            // Create blob and download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcript_${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading transcript:', error);
            alert('Failed to download transcript.');
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
});
