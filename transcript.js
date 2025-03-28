import config from './src/config/config.browser.js';


function formatSources(sources) {
    console.log('📖 Formatting sources:', sources);
    
    if (!sources || !Array.isArray(sources)) {
        console.log('⚠️ Invalid sources data:', sources);
        return null;
    }
    
    try {
        const validSources = sources.filter(source => {
            const isValid = source && source.url && source.title;
            if (!isValid) {
                console.log('❗ Filtered out invalid source:', source);
            }
            return isValid;
        });
        
        console.log(`📋 Valid sources: ${validSources.length} of ${sources.length}`);
        
        if (validSources.length === 0) {
            return null;
        }

        const sourcesContainer = document.createElement('div');
        sourcesContainer.className = 'sources-section';
        
        // Sources list
        validSources.forEach(source => {
            const sourceItem = document.createElement('div');
            sourceItem.className = 'source-item';

            // Title and content container
            const contentDiv = document.createElement('div');
            contentDiv.className = 'source-content';

            // Title with link
            const titleLink = document.createElement('a');
            titleLink.href = source.url;
            titleLink.target = '_blank';
            titleLink.className = 'source-title';
            titleLink.textContent = source.title;
            contentDiv.appendChild(titleLink);

            // Metadata section
            const metaDiv = document.createElement('div');
            metaDiv.className = 'source-meta';

            // First row: Authors, Journal, Peer Review
            const topRow = document.createElement('div');
            topRow.className = 'source-meta-row';

            // Authors
            if (source.authors) {
                const authorSpan = document.createElement('span');
                authorSpan.className = 'source-meta-item';
                authorSpan.innerHTML = `👤 ${source.authors}`;
                topRow.appendChild(authorSpan);

                const separator = document.createElement('span');
                separator.className = 'separator';
                separator.textContent = '•';
                topRow.appendChild(separator);
            }

            // Journal with peer review badge
            if (source.journal) {
                const journalSpan = document.createElement('span');
                journalSpan.className = 'source-meta-item';
                journalSpan.innerHTML = `📰 ${source.journal}`;
                topRow.appendChild(journalSpan);
                
                if (source.peerReviewed) {
                    const separator = document.createElement('span');
                    separator.className = 'separator';
                    separator.textContent = '•';
                    topRow.appendChild(separator);

                    const peerReviewSpan = document.createElement('span');
                    peerReviewSpan.className = 'source-meta-item';
                    const iconSpan = document.createElement('span');
                    iconSpan.className = source.peerReviewed ? 'peer-reviewed-true' : 'peer-reviewed-false';
                    iconSpan.textContent = '☎';
                    peerReviewSpan.appendChild(iconSpan);
                    peerReviewSpan.appendChild(document.createTextNode(' Peer Reviewed'));
                    topRow.appendChild(peerReviewSpan);
                }
            }

            metaDiv.appendChild(topRow);

            // Second row: Year and Citations
            if (source.year || source.citations) {
                const bottomRow = document.createElement('div');
                bottomRow.className = 'source-meta-row';

                // Year
                if (source.year) {
                    const yearSpan = document.createElement('span');
                    yearSpan.className = 'source-meta-item';
                    yearSpan.innerHTML = `📅 ${source.year}`;
                    bottomRow.appendChild(yearSpan);

                    if (source.citations) {
                        const separator = document.createElement('span');
                        separator.className = 'separator';
                        separator.textContent = '•';
                        bottomRow.appendChild(separator);
                    }
                }

                // Citations
                if (source.citations) {
                    const citationsSpan = document.createElement('span');
                    citationsSpan.className = 'source-meta-item';
                    citationsSpan.innerHTML = `📊 ${source.citations} citations`;
                    bottomRow.appendChild(citationsSpan);
                }

                metaDiv.appendChild(bottomRow);
            }

            contentDiv.appendChild(metaDiv);

            // Summary text
            if (source.summary) {
                const summaryText = document.createElement('div');
                summaryText.className = 'source-text';
                summaryText.textContent = source.summary;
                contentDiv.appendChild(summaryText);
            }

            sourceItem.appendChild(contentDiv);

            // Stance indicator at bottom
            if (source.stance) {
                const stanceIcon = {
                    'Support': '✅',
                    'Oppose': '❌',
                    'Neutral': '⚖️'
                }[source.stance] || '•';
                
                const stanceText = document.createElement('div');
                stanceText.className = 'source-stance';
                stanceText.setAttribute('data-stance', source.stance);
                stanceText.innerHTML = `<strong>${stanceIcon} ${source.stance}</strong>`;
                sourceItem.appendChild(stanceText);
            }

            sourcesContainer.appendChild(sourceItem);
        });

        return sourcesContainer;
    } catch (error) {
        console.error('❌ Error formatting sources:', error);
        console.log('📝 Raw sources data:', JSON.stringify(sources, null, 2));
        return null;
    }
}

function displayAnalysis(analysis) {
    if (!analysis) {
        console.error('❌ No analysis data provided');
        return;
    }

    // Display video title
    const videoTitle = document.getElementById('video-title');
    videoTitle.textContent = `Analysis of Strong Claims in ${analysis.videoTitle || 'Video'}`;

    // Display video summary
    const videoSummary = document.getElementById('video-summary');
    videoSummary.textContent = analysis.summary || 'No summary available';

    // Clear and prepare analysis content
    const analysisContent = document.getElementById('analysis-content');
    analysisContent.innerHTML = '';

    if (!analysis.claims || !Array.isArray(analysis.claims) || analysis.claims.length === 0) {
        analysisContent.innerHTML = '<div class="claim-section">No claims to analyze</div>';
        return;
    }

    // Display claims
    analysis.claims.forEach((claim, index) => {
        const claimSection = document.createElement('div');
        claimSection.className = 'claim-section';

        // Claim title
        const claimTitle = document.createElement('h3');
        claimTitle.className = 'claim-title';
        const titleText = typeof claim === 'object' ? 
            (claim.title || claim.topic || claim.claim || `Claim ${index + 1}`) :
            claim;
        claimTitle.textContent = `Claim ${index + 1}: ${titleText.replace(/^\d+\.\s*/, '')}`;
        claimSection.appendChild(claimTitle);

        const claimContent = document.createElement('div');
        claimContent.className = 'claim-content';

        // Summary
        if (claim.summary || titleText) {
            const summary = document.createElement('div');
            summary.className = 'claim-item';
            summary.innerHTML = `<strong>Summary:</strong> ${claim.summary || titleText}`;
            claimContent.appendChild(summary);
        }

        // Consensus with icon
        if (claim.consensus) {
            const consensus = document.createElement('div');
            consensus.className = 'claim-item';
            consensus.innerHTML = `<strong>🔍 Scientific Consensus:</strong> ${claim.consensus}`;
            claimContent.appendChild(consensus);
        }

        // Assessment with icon
        if (claim.assessment) {
            const assessment = document.createElement('div');
            assessment.className = 'claim-item';
            const color = claim.color || 'inherit';
            assessment.innerHTML = `<strong>📊 Assessment:</strong> <span style="color: ${color}">${claim.assessment}</span>`;
            claimContent.appendChild(assessment);
        }

        // Sources Section
        if (claim.sources && Array.isArray(claim.sources)) {
            const sourcesElement = formatSources(claim.sources);
            if (sourcesElement) {
                // Create toggle button
                const toggleButton = document.createElement('button');
                toggleButton.className = 'sources-toggle';
                toggleButton.textContent = 'Sources';
                toggleButton.onclick = function() {
                    this.classList.toggle('expanded');
                    sourcesElement.classList.toggle('expanded');
                };
                claimContent.appendChild(toggleButton);
                claimContent.appendChild(sourcesElement);
            }
        }

        // Claim Status with icon
        if (claim.agreementStatus) {
            const agreement = document.createElement('div');
            agreement.className = 'claim-item';
            const color = claim.color || 'inherit';
            const icon = {
                'Support': '✅',
                'Oppose': '❌',
                'Neutral': '⚖️'
            }[claim.agreementStatus] || '•';
            agreement.innerHTML = `<strong>${icon} Claim Status:</strong> <span style="color: ${color}">${claim.agreementStatus}</span>`;
            claimContent.appendChild(agreement);
        }

        claimSection.appendChild(claimContent);
        analysisContent.appendChild(claimSection);
    });
}


async function analyzeTranscript(transcriptData, analysisKey) {
    try {
        const clientStartTime = Date.now();
        
        // Get settings from storage
        const { fullReportEnabled } = await chrome.storage.local.get('fullReportEnabled');
        const { saveLocalData } = await chrome.storage.sync.get('settings');
        
        // Call server API to analyze transcript
        const response = await fetch(config.PROXY_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcript: transcriptData.fullText,
                clientStartTime,
                fullReport: fullReportEnabled,
                saveLocalData: saveLocalData?.saveLocalData ?? false // Use setting from storage or default to false
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
    // Add loading class to body
    document.body.classList.add('loading');
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
        
        // Hide loading screen with fade out
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('hidden');
        document.body.classList.remove('loading');
        
        // Remove loading screen after fade out
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);

    } catch (error) {
        document.getElementById('video-title').textContent = `Error: ${error.message}`;
        document.getElementById('analysis-content').innerHTML = '<p>Failed to load content</p>';
        
        // Hide loading screen on error
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('hidden');
        document.body.classList.remove('loading');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
});
