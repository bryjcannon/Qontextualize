import { getVideoId } from '../utils/youtube-utils.js';
import { FirebaseService } from './firebase-service.js';

class BrowserStorageService {
    constructor() {
        this.transcriptKey = null;
        this.analysisKey = null;
        this.firebase = new FirebaseService();
    }

    /**
     * Generate HTML content for storage
     * @param {Object} transcriptData - Transcript data to convert to HTML
     * @returns {string} HTML content
     */
    generateTranscriptHtml(transcriptData) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${transcriptData.videoTitle}</title>
                <meta charset="utf-8">
            </head>
            <body>
                <h1>${transcriptData.videoTitle}</h1>
                <div class="transcript-content">
                    ${transcriptData.transcript.map(segment => `
                        <div class="segment" data-start="${segment.start}" data-end="${segment.end}">
                            ${segment.text}
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Parse HTML content back to transcript data
     * @param {string} htmlContent - HTML content to parse
     * @returns {Object} Transcript data
     */
    parseTranscriptHtml(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const videoTitle = doc.querySelector('h1').textContent;
        const segments = Array.from(doc.querySelectorAll('.segment')).map(segment => ({
            start: parseFloat(segment.dataset.start),
            end: parseFloat(segment.dataset.end),
            text: segment.textContent.trim()
        }));

        return {
            videoTitle,
            transcript: segments
        };
    }

    /**
     * Save transcript data to both local storage and Firebase
     * @param {string} videoUrl - YouTube video URL
     * @param {Object} transcriptData - Transcript data to save
     * @returns {Promise<Object>} Keys for accessing the saved data
     */
    async saveTranscript(videoUrl, transcriptData) {
        const videoId = getVideoId(videoUrl);
        if (!videoId) {
            throw new Error('Invalid video URL');
        }

        this.transcriptKey = `transcript_${videoId}`;
        this.analysisKey = `analysis_${videoId}`;

        // Save to local storage for immediate use
        await chrome.storage.local.set({
            [this.transcriptKey]: transcriptData
        });

        // Save to Firebase
        const metadata = {
            videoUrl,
            videoTitle: transcriptData.videoTitle,
            videoId,
            transcriptKey: this.transcriptKey,
            analysisKey: this.analysisKey
        };

        // Generate HTML content
        const htmlContent = this.generateTranscriptHtml(transcriptData);
        
        // Store in Firebase
        await this.firebase.storeTranscript(videoId, metadata, htmlContent);

        return {
            transcriptKey: this.transcriptKey,
            analysisKey: this.analysisKey
        };
    }

    /**
     * Get transcript data from Firebase or local storage
     * @param {string} videoUrl - YouTube video URL
     * @returns {Promise<Object|null>} Transcript data if found
     */
    async getTranscript(videoUrl) {
        const videoId = getVideoId(videoUrl);
        if (!videoId) {
            throw new Error('Invalid video URL');
        }

        // Check Firebase first
        try {
            const metadata = await this.firebase.getTranscriptMetadata(videoId);
            if (metadata) {
                // Get HTML content from Cloud Storage
                const htmlContent = await this.firebase.fetchTranscriptContent(metadata.storageUrl);
                
                // Parse HTML content back to transcript data
                const transcriptData = this.parseTranscriptHtml(htmlContent);
                
                // Cache in local storage
                const transcriptKey = `transcript_${videoId}`;
                await chrome.storage.local.set({ [transcriptKey]: transcriptData });
                
                return transcriptData;
            }
        } catch (error) {
            console.warn('Failed to fetch from Firebase, falling back to local storage:', error);
        }

        // Fall back to local storage
        const transcriptKey = `transcript_${videoId}`;
        const result = await chrome.storage.local.get(transcriptKey);
        return result[transcriptKey];
    }

    /**
     * Get analysis data from local storage
     * @param {string} videoUrl - YouTube video URL
     * @returns {Promise<Object|null>} Analysis data if found
     */
    async getAnalysis(videoUrl) {
        const videoId = getVideoId(videoUrl);
        if (!videoId) {
            throw new Error('Invalid video URL');
        }

        // Check Firebase first
        try {
            const metadata = await this.firebase.getTranscriptMetadata(videoId);
            if (metadata) {
                const analysisKey = metadata.analysisKey;
                const result = await chrome.storage.local.get(analysisKey);
                if (result[analysisKey]) {
                    return result[analysisKey];
                }
            }
        } catch (error) {
            console.warn('Failed to fetch from Firebase, falling back to local storage:', error);
        }

        // Fall back to local storage
        const analysisKey = `analysis_${videoId}`;
        const result = await chrome.storage.local.get(analysisKey);
        return result[analysisKey];
    }

    /**
     * Save analysis data to local storage and update Firebase metadata
     * @param {string} videoUrl - YouTube video URL
     * @param {Object} analysisData - Analysis data to save
     */
    async saveAnalysis(videoUrl, analysisData) {
        const videoId = getVideoId(videoUrl);
        if (!videoId) {
            throw new Error('Invalid video URL');
        }

        const analysisKey = `analysis_${videoId}`;
        
        // Save to local storage
        await chrome.storage.local.set({
            [analysisKey]: analysisData
        });

        // Update Firebase metadata
        try {
            const metadata = await this.firebase.getTranscriptMetadata(videoId);
            if (metadata) {
                metadata.hasAnalysis = true;
                metadata.updatedAt = new Date().toISOString();
                await this.firebase.updateMetadata(videoId, metadata);
            }
        } catch (error) {
            console.warn('Failed to update Firebase metadata:', error);
        }
    }
}

// Export singleton instance
const browserStorageService = new BrowserStorageService();
export default browserStorageService;
