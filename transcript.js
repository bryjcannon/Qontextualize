import config from './config.browser.js';


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
        
        // Source statistics
        const currentYear = new Date().getFullYear();
        const stats = {
            totalCount: validSources.length,
            peerReviewedCount: validSources.filter(s => s.journal).length,
            recentSourceCount: validSources.filter(s => s.year && currentYear - parseInt(s.year) <= 3).length,
            domains: Object.entries(validSources.reduce((acc, s) => {
                const domain = new URL(s.url).hostname.replace('www.', '');
                acc[domain] = (acc[domain] || 0) + 1;
                return acc;
            }, {})).sort((a, b) => b[1] - a[1])
        };

        const statsDiv = document.createElement('div');
        statsDiv.className = 'source-stats';
        statsDiv.innerHTML = `
            <strong>Source Analysis:</strong>
            <ul>
                <li>📚 ${stats.totalCount} scientific source${stats.totalCount !== 1 ? 's' : ''}</li>
                ${stats.peerReviewedCount ? `<li>✅ ${stats.peerReviewedCount} peer-reviewed publication${stats.peerReviewedCount !== 1 ? 's' : ''}</li>` : ''}
                ${stats.recentSourceCount ? `<li>🕒 ${stats.recentSourceCount} source${stats.recentSourceCount !== 1 ? 's' : ''} from the past 3 years</li>` : ''}
                ${stats.domains.length ? `<li>🌐 Sources from: ${stats.domains.map(([domain, count]) => `${domain} (${count})`).join(', ')}</li>` : ''}
            </ul>
        `;
        sourcesContainer.appendChild(statsDiv);

        // Sources list
        validSources.forEach(source => {
            console.log('📕 Processing source:', source);
            const sourceItem = document.createElement('div');
            sourceItem.className = 'source-item';

            // Title with link
            const titleLink = document.createElement('a');
            titleLink.href = source.url;
            titleLink.target = '_blank';
            titleLink.className = 'source-title';
            titleLink.textContent = source.title;
            sourceItem.appendChild(titleLink);

            // Metadata
            const meta = document.createElement('div');
            meta.className = 'source-meta';
            const metaParts = [];
            if (source.authors) metaParts.push(`👥 ${source.authors}`);
            if (source.journal) {
                metaParts.push(`📰 ${source.journal}`);
                const peerReviewedBadge = document.createElement('span');
                peerReviewedBadge.className = 'peer-reviewed-badge';
                peerReviewedBadge.textContent = 'Peer Reviewed';
                meta.appendChild(document.createTextNode(metaParts.join(' • ')));
                meta.appendChild(peerReviewedBadge);
            } else {
                meta.textContent = metaParts.join(' • ');
            }
            sourceItem.appendChild(meta);

            // Additional metadata
            const additionalMeta = document.createElement('div');
            additionalMeta.className = 'source-meta';
            const additionalParts = [];
            if (source.year) additionalParts.push(`📅 ${source.year}`);
            if (source.citations) additionalParts.push(`📊 ${source.citations} citations`);
            if (additionalParts.length > 0) {
                additionalMeta.textContent = additionalParts.join(' • ');
                sourceItem.appendChild(additionalMeta);
            }

            // Summary
            if (source.summary) {
                const summary = document.createElement('div');
                summary.className = 'source-summary';
                summary.textContent = source.summary;
                sourceItem.appendChild(summary);
            }

            // Stance with icon
            if (source.stance) {
                const stance = document.createElement('div');
                stance.className = `source-stance stance-${source.stance.toLowerCase()}`;
                const stanceIcon = {
                    'agrees': '✅',
                    'disagrees': '❌',
                    'neutral': '⚖️'
                }[source.stance.toLowerCase()] || '•';
                stance.textContent = `${stanceIcon} ${source.stance.charAt(0).toUpperCase() + source.stance.slice(1)}`;
                sourceItem.appendChild(stance);
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
                claimContent.appendChild(sourcesElement);
            }
        }

        // Agreement Status with icon
        if (claim.agreementStatus) {
            const agreement = document.createElement('div');
            agreement.className = 'claim-item';
            const color = claim.color || 'inherit';
            const icon = {
                'agrees': '✅',
                'disagrees': '❌',
                'neutral': '⚖️'
            }[claim.agreementStatus.toLowerCase()] || '•';
            const status = claim.agreementStatus.charAt(0).toUpperCase() + claim.agreementStatus.slice(1);
            agreement.innerHTML = `<strong>${icon} Agreement Status:</strong> <span style="color: ${color}">${status}</span>`;
            claimContent.appendChild(agreement);
        }

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
