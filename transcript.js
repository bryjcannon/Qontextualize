import config from './config.browser.js';


function formatSources(sources) {
    console.log('📖 Formatting sources:', sources);
    
    if (!sources || !Array.isArray(sources)) {
        console.log('⚠️ Invalid sources data:', sources);
        return 'No sources available';
    }
    
    try {
        const validSources = sources.filter(source => {
            const isValid = source && source.url;
            if (!isValid) {
                console.log('❗ Filtered out invalid source:', source);
            }
            return isValid;
        });
        
        console.log(`📋 Valid sources: ${validSources.length} of ${sources.length}`);
        
        const formattedSources = validSources.map(source => {
            console.log('📕 Processing source:', source);
            const domain = source.domain || new URL(source.url).hostname;
            const displayText = source.title || `${domain} Source`;
            const link = `<a href="${source.url}" target="_blank" class="source-link ${domain.split('.')[0]}">
                ${displayText}
                <span class="source-domain">(${domain})</span>
            </a>`;
            console.log('🔗 Generated link:', link);
            return link;
        });

        const result = formattedSources.join('\n') || 'No sources available';
        console.log('🌟 Final formatted sources:', result);
        return result;
    } catch (error) {
        console.error('❌ Error formatting sources:', error);
        console.log('📝 Raw sources data:', JSON.stringify(sources, null, 2));
        return 'Error displaying sources';
    }
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

        const claimTitle = document.createElement('h3');
        claimTitle.className = 'claim-title';
        claimTitle.textContent = `Claim ${index + 1}: ${claim.title}`;
        claimSection.appendChild(claimTitle);

        const claimContent = document.createElement('div');
        claimContent.className = 'claim-content';

        // Summary
        const summary = document.createElement('div');
        summary.className = 'claim-item';
        summary.innerHTML = `<strong>Summary of Claim:</strong> ${claim.summary}`;
        claimContent.appendChild(summary);

        // Source
        if (claim.source) {
            const source = document.createElement('div');
            source.className = 'claim-item';
            source.innerHTML = `<strong>Source Mentioned:</strong> ${claim.source}`;
            claimContent.appendChild(source);
        }

        // Consensus
        const consensus = document.createElement('div');
        consensus.className = 'claim-item';
        consensus.innerHTML = `<strong>Scientific Consensus:</strong> ${claim.consensus}`;
        claimContent.appendChild(consensus);

        // Assessment
        const assessment = document.createElement('div');
        assessment.className = 'claim-item';
        const assessmentClass = claim.assessment.toLowerCase().includes('not supported') ? ' assessment-not-supported' : '';
        assessment.innerHTML = `<strong>Assessment:</strong><span class="${assessmentClass}">${claim.assessment}</span>`;
        claimContent.appendChild(assessment);

        claimSection.appendChild(claimContent);
        analysisContent.appendChild(claimSection);
    });
}


async function analyzeTranscript(transcriptData, analysisKey) {
    try {
        const clientStartTime = Date.now();
        
        // Get full report setting from storage
        const { fullReportEnabled } = await chrome.storage.local.get('fullReportEnabled');
        
        // Call server API to analyze transcript
        const response = await fetch(config.PROXY_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcript: transcriptData.fullText,
                clientStartTime,
                fullReport: fullReportEnabled
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
