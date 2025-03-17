require('dotenv').config();
const readline = require('readline');
const searchSources = require('./searchSources.js');
const formatResults = require('./formatSourceResults');
const generateReport = require('./generateSourceReport');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getClaimInput() {
    rl.question("\nEnter your scientific claim: ", async (claim) => {
        console.log("\nProcessing claim, please wait...\n");
        const sources = await searchSources.fetchScholarResults(claim);

        if (sources.length === 0) {
            console.log("No sources found.");
        } else {
            const formattedData = await formatResults.processStudies(claim, sources);
            generateReport.saveToJSON(claim, formattedData);
        }

        rl.close();
    });
}

getClaimInput();
