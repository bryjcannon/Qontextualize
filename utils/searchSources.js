const axios = require('axios');
const { SERPAPI_KEY } = require('./config');

async function fetchScholarResults(claim) {
    const query = `"${claim}" AND ("meta-analysis" OR "RCT" OR "systematic review")`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&engine=google_scholar&api_key=${SERPAPI_KEY}`;

    try {
        const response = await axios.get(url);
        return response.data.organic_results.slice(0, 12); // Top 12 results
    } catch (error) {
        console.error("Error fetching Google Scholar results:", error);
        return [];
    }
}

module.exports = { fetchScholarResults };
