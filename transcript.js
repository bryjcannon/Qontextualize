import config from './config.js';

function formatTimestamps(timestamps) {
    return timestamps.map(ts => `<span class="timestamp">${ts}</span>`).join('');
}

function formatSources(sources) {
    return sources.map(source => {
        if (source.url) {
            return `<a href="${source.url}" target="_blank">${source.title || source.url}</a>`;
        }
        return source.title || source;
    }).join('');
}

function displayAnalysis(analysis) {
    // Display video title
    const videoTitle = document.getElementById('video-title');
    videoTitle.textContent = `Analysis of Strong Claims in ${analysis.videoTitle || 'Video'}`;

    // Display video summary
    const videoSummary = document.getElementById('video-summary');
    videoSummary.textContent = analysis.summary;

    // Clear and prepare analysis content
    const analysisContent = document.getElementById('analysis-content');
    analysisContent.innerHTML = '';

    // Display claims
    analysis.claims.forEach((claim, index) => {
        const claimSection = document.createElement('div');
        claimSection.className = 'claim-section';

        const claimTitle = document.createElement('h3');
        claimTitle.textContent = `Claim ${index + 1}: ${claim.title}`;

        const claimSummary = document.createElement('div');
        claimSummary.className = 'claim-text';
        claimSummary.innerHTML = `<strong>Summary of Claim:</strong> ${claim.summary}`;

        const timestamps = document.createElement('div');
        timestamps.className = 'claim-text';
        timestamps.innerHTML = `<strong>Timestamp:</strong> ${formatTimestamps(claim.timestamps)}`;

        const sources = document.createElement('div');
        sources.className = 'claim-text';
        sources.innerHTML = `<strong>Source Mentioned:</strong> ${formatSources(claim.sources)}`;

        const consensus = document.createElement('div');
        consensus.className = 'claim-text';
        consensus.innerHTML = `<strong>Scientific Consensus:</strong> ${claim.consensus}`;

        const assessment = document.createElement('div');
        assessment.className = 'claim-text';
        assessment.innerHTML = `<strong>Assessment:</strong> ${claim.assessment}`;

        claimSection.appendChild(claimTitle);
        claimSection.appendChild(claimSummary);
        claimSection.appendChild(timestamps);
        claimSection.appendChild(sources);
        claimSection.appendChild(consensus);
        claimSection.appendChild(assessment);

        analysisContent.appendChild(claimSection);
    });
}


async function analyzeTranscript(transcriptData, analysisKey) {
    try {
        const clientStartTime = Date.now();
        
        // Call server API to analyze transcript
        const response = await fetch(config.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcript: transcriptData.fullText,
                clientStartTime
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const analysis = await response.json();

        // Store analysis
        await chrome.storage.local.set({
            [analysisKey]: {
                ...analysis,
                timestamp: Date.now()
            }
        });

        return analysis;
    } catch (error) {
        console.error('Error analyzing transcript:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Get transcript data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const transcriptKey = urlParams.get('transcriptKey');
    const analysisKey = urlParams.get('analysisKey');
    
    if (!transcriptKey || !analysisKey) {
        document.getElementById('video-title').textContent = 'Error: Missing required parameters';
        return;
    }

    try {
        // Validate key formats
        if (!transcriptKey.startsWith('transcript_') || !analysisKey.startsWith('analysis_')) {
            throw new Error('Invalid key format');
        }

        // Get transcript and existing analysis from chrome.storage
        const result = await chrome.storage.local.get([transcriptKey, analysisKey]);
        const transcriptData = result[transcriptKey];
        let analysisData = result[analysisKey];
        
        if (!transcriptData) {
            throw new Error('Transcript not found');
        }

        // Update analysis section
        const analysisContent = document.getElementById('analysis-content');
        
        if (!analysisData) {
            // Generate new analysis
            analysisContent.innerHTML = '<p>Analyzing scientific claims...</p>';
            try {
                const analysis = await analyzeTranscript(transcriptData, analysisKey);
                displayAnalysis(analysis);
            } catch (error) {
                analysisContent.innerHTML = `<p>Error analyzing transcript: ${error.message}</p>`;
            }
        } else {
            // Use existing analysis
            displayAnalysis(analysisData);
        }

        // Update title
        document.getElementById('video-title').textContent = `Analysis of Strong Claims in ${transcriptData.videoTitle}`;
        

    } catch (error) {
        document.getElementById('video-title').textContent = `Error: ${error.message}`;
        document.getElementById('analysis-content').innerHTML = '<p>Failed to load content</p>';
    }
});
