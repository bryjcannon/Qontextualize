import { fetchScholarResults } from './searchSources.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSourceFinding() {
    // Test claim
    const testClaim = "Regular exercise reduces the risk of cardiovascular disease";
    
    console.log('Testing source finding with claim:', testClaim);
    console.log('SERPAPI_KEY present:', !!process.env.SERPAPI_KEY);
    
    try {
        console.log('\nFetching sources...');
        const sources = await fetchScholarResults(testClaim);
        
        console.log('\nResults:');
        console.log('Number of sources found:', sources.length);
        
        if (sources.length > 0) {
            console.log('\nFirst source details:');
            console.log(JSON.stringify(sources[0], null, 2));
            
            console.log('\nAll source titles:');
            sources.forEach((source, i) => {
                console.log(`[${i + 1}] ${source.title}`);
            });
        } else {
            console.log('No sources found');
        }
    } catch (error) {
        console.error('Error in test:', error);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
    }
}

// Run the test
testSourceFinding();
