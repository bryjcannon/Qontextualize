import axios from 'axios';

/**
 * Fetch relevant academic sources from Google Scholar for a given claim
 * @param {string} claim - The scientific claim to search for
 * @returns {Promise<Array>} Array of source objects with title, link, and other metadata
 */
export async function fetchScholarResults(claim) {
    if (!process.env.SERPAPI_KEY) {
        throw new Error('SERPAPI_KEY not found in environment variables. Get your key at https://serpapi.com/');
    }

    try {
        // Construct a targeted search query
        const query = `"${claim}" AND ("meta-analysis" OR "systematic review" OR "randomized controlled trial")`;
        const url = `https://serpapi.com/search.json`;
        
        const response = await axios.get(url, {
            params: {
                q: query,
                engine: 'google_scholar',
                api_key: process.env.SERPAPI_KEY,
                num: 10 // Number of results to return
            }
        });

        if (!response.data?.organic_results?.length) {
            console.warn('No results found in Google Scholar response');
            return [];
        }

        // Process and return results
        return response.data.organic_results.map(result => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet,
            authors: result.publication_info?.authors?.join(', '),
            year: result.publication_info?.year,
            citedBy: result.inline_links?.cited_by?.total || null
        }));

    } catch (error) {
        console.error('Error fetching Google Scholar results:', error.message);
        if (error.response?.data) {
            console.error('API Response:', error.response.data);
        }
        throw error; // Let the caller handle the error
    }
}

export { fetchScholarResults };

