import config from '../config/config.browser.js';

class OpenAIService {
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async summarizeTranscript(transcript) {
        let lastError;
        
        for (let attempt = 1; attempt <= config.MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(config.PROXY_API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ transcript })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `API request failed: ${response.status}`);
                }

                const data = await response.json();
                return data.summary;
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);
                lastError = error;
                
                if (attempt < config.MAX_RETRIES) {
                    await this.sleep(config.RETRY_DELAY * attempt);
                }
            }
        }

        throw lastError;
    }
}

export default OpenAIService;
