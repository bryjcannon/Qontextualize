import fetch from 'node-fetch';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

// Private helper function to calculate text relevance
function calculateRelevance(query, text) {
    if (!text) return 0;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    // Calculate what percentage of query terms appear in the text
    const termMatches = queryTerms.filter(term => textLower.includes(term)).length;
    const termScore = termMatches / queryTerms.length;
    
    // Bonus for exact phrase match
    const phraseScore = textLower.includes(query.toLowerCase()) ? 0.3 : 0;
    
    // Bonus for scientific terms
    const scientificTerms = ['study', 'research', 'trial', 'analysis', 'evidence', 'data', 'findings'];
    const scientificScore = scientificTerms.some(term => textLower.includes(term)) ? 0.2 : 0;
    
    return Math.min(1, termScore + phraseScore + scientificScore);
}

// Private helper function to fetch sources from a specific domain
async function _fetchSourceLinks(query, domain) {
    console.log('🔍 Fetching sources for query:', { query, domain });
    
    try {
        // Use Google Custom Search API instead of web scraping
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_SEARCH_CX;
        
        console.log('🔑 API Key:', apiKey ? 'Set' : 'Not Set');
        console.log('🌐 Search Engine ID:', cx ? 'Set' : 'Not Set');
        
        if (!apiKey || !cx) {
            throw new Error('Google API credentials not found in environment variables');
        }
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}${domain ? `+site:${domain}` : ''}`;
        
        // Log URL with redacted credentials
        console.log('🌐 Making API request to:', searchUrl.replace(apiKey, '***').replace(cx, '***'));
        
        const response = await fetch(searchUrl, {
            headers: {
                'Referer': 'chrome-extension://qontext.extension'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📊 Raw search results:', data);
        
        if (!data.items) {
            console.log('⚠️ No search results found');
            return [];
        }
        
        const trustedDomains = domain ? [domain] : ['cdc.gov', 'who.int', 'nejm.org', 'ncbi.nlm.nih.gov'];
        
        const links = data.items
            .filter(item => trustedDomains.some(d => item.link.includes(d)))
            .map(item => {
                // Extract metadata
                const metadata = item.pagemap || {};
                const metatags = metadata.metatags?.[0] || {};
                const citation = metadata.citation?.[0] || {};
                
                // Calculate relevance score
                const titleRelevance = calculateRelevance(query, item.title);
                const snippetRelevance = calculateRelevance(query, item.snippet || '');
                const dateBonus = metatags['article:published_time'] ? 0.2 : 0;
                const citationBonus = citation.author ? 0.3 : 0;
                const peerReviewedBonus = item.link.includes('pubmed') || item.link.includes('nejm.org') ? 0.3 : 0;
                
                const relevanceScore = Math.min(1, 
                    titleRelevance * 0.6 + 
                    snippetRelevance * 0.4 + 
                    dateBonus + 
                    citationBonus + 
                    peerReviewedBonus
                );
                
                return {
                    url: item.link,
                    title: item.title,
                    domain: domain || trustedDomains.find(d => item.link.includes(d)),
                    snippet: item.snippet,
                    publishedDate: metatags['article:published_time'] || citation.publicationDate,
                    authors: citation.author,
                    journal: citation.journal,
                    isPeerReviewed: item.link.includes('pubmed') || item.link.includes('nejm.org'),
                    relevanceScore
                };
            })
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
            
        console.log('📋 Processed links:', links);
        return links.slice(0, 3); // Return top 3 most relevant sources
    } catch (error) {
        console.error('❌ Error fetching source links:', error);
        return [];
    }
}

// Private helper function to search a domain and get weighted results
async function _searchDomain(query, domain, weight) {
    console.log(`🌐 Searching domain: ${domain}`);
    const searchQuery = `${query} research evidence`;
    
    try {
        const results = await _fetchSourceLinks(searchQuery, domain);
        
        // Add domain-specific weight to results
        return results.map(source => ({
            ...source,
            weight,
            domainScore: weight * (results.indexOf(source) === 0 ? 1.2 : 1) // Boost first result slightly
        }));
    } catch (error) {
        console.error(`❌ Error searching ${domain}:`, error);
        return [];
    }
}

export {};
                         model: "gpt-4o",
                         messages: [{ role: "user", content: consensusPrompt }]
                     });
                     verification.consensus = consensusResponse.choices[0].message.content;
                 }

                 // Get and analyze sources for this claim
                 console.log(`📓 Processing sources for topic: ${topic}`);
                 const sources = await fetchSources(`${topic}: ${claimText}`);
                 console.log(`📁 Found ${sources.length} sources for topic`);
                 
                 // Analyze source quality and relevance
                 let sourceAnalysis = '';
                 if (sources.length > 0) {
                     const currentYear = new Date().getFullYear();
                     const domainCounts = {};
                     let peerReviewedCount = 0;
                     let recentSourceCount = 0;
                     
                     sources.forEach(src => {
                         domainCounts[src.domain] = (domainCounts[src.domain] || 0) + 1;
                         if (src.isPeerReviewed) peerReviewedCount++;
                         if (src.publishedDate) {
                             const pubYear = new Date(src.publishedDate).getFullYear();
                             if (currentYear - pubYear <= 3) recentSourceCount++;
                         }
                     });
                     
                     const topDomains = Object.entries(domainCounts)
                         .sort((a, b) => b[1] - a[1])
                         .map(([domain, count]) => `${domain} (${count})`)
                         .join(', ');
                     
                     sourceAnalysis = `\n\nThis assessment is supported by ${sources.length} scientific sources`
                         + (peerReviewedCount > 0 ? `, including ${peerReviewedCount} peer-reviewed publication${peerReviewedCount > 1 ? 's' : ''}` : '')
                         + (recentSourceCount > 0 ? `, with ${recentSourceCount} source${recentSourceCount > 1 ? 's' : ''} from the past 3 years` : '')
                         + `. Sources come from ${topDomains}.\n\n`;
                     
                     const keySourceInfo = sources.slice(0, 2).map(source => {
                         let info = `${source.title}`;
                         if (source.authors) info += ` by ${source.authors}`;
                         if (source.journal) info += ` (${source.journal})`;
                         if (source.publishedDate) info += `, ${new Date(source.publishedDate).getFullYear()}`;
                         return info;
                     });
                     
                     if (keySourceInfo.length > 0) {
                         sourceAnalysis += `Key references:\n- ${keySourceInfo.join('\n- ')}`;
                     }
                 }
                 
                 const assessment = sources.length === 0
                     ? verification.assessment + '\n\nNote: While this assessment is based on general scientific knowledge, we were unable to find direct scientific sources for this specific claim. Consider consulting additional academic databases or medical professionals for verification.'
                     : verification.assessment + sourceAnalysis;

                 // Determine agreement status and color code
                 const consensusAgreement = determineClaimAgreement(verification.consensus);
                 const assessmentAgreement = determineClaimAgreement(assessment);
                 
                 // Use most definitive agreement status (prefer disagreement over neutral)
                 const agreementStatus = 
                     consensusAgreement === 'disagrees' || assessmentAgreement === 'disagrees' ? 'disagrees' :
                     consensusAgreement === 'agrees' || assessmentAgreement === 'agrees' ? 'agrees' : 'neutral';

                 // Apply color based on agreement
                 const color = {
                     'agrees': 'green',
                     'disagrees': 'red',
                     'neutral': 'white'
                 }[agreementStatus];

                 const result = {
                     title: topic,
                     summary: claimText.trim(),
                     timestamps: timestamps[topic] || [],
                     sources,
                     consensus: verification.consensus,
                     assessment,
                     color,
                     agreementStatus
                 };

                 console.log('📚 Final report section:', {
                     title: result.title,
                     sourcesCount: sources.length,

                     hasConsensus: !!result.consensus,
                     agreementStatus: result.agreementStatus
                 });

                 return result;
             } catch (error) {
                 console.error(`Error processing claim '${topic}':`, error);
                 return {
                     title: topic,
                     summary: claimText.trim(),
                     sources: [],
                     consensus: 'Error: Could not verify scientific consensus',
                     assessment: 'Error: Could not fully analyze this claim',
                     color: 'white',
                     agreementStatus: 'neutral'
                 };
             }
         })
 );
 
 return {
     videoTitle: 'Video Analysis',  // This will be set by the frontend
     summary,
     claims: processedClaims
 };

 async function fetchSourceLinks(query, domain) {
    console.log('🔎 Fetching sources for query:', { query, domain });
    
    try {
        // Use Google Custom Search API instead of web scraping
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_SEARCH_CX;
        
        console.log('🔑 API Key:', apiKey ? 'Set' : 'Not Set');
        console.log('🌐 Search Engine ID:', cx ? 'Set' : 'Not Set');
        
        if (!apiKey || !cx) {
            throw new Error('Google API credentials not found in environment variables');
        }
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}${domain ? `+site:${domain}` : ''}`;
        
        // Log URL with redacted credentials
        console.log('🌐 Making API request to:', searchUrl.replace(process.env.GOOGLE_API_KEY, '***').replace(process.env.GOOGLE_SEARCH_CX, '***'));
        
        const response = await fetch(searchUrl, {
            headers: {
                'Referer': 'chrome-extension://qontext.extension'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📊 Raw search results:', data);
        
        if (!data.items) {
            console.log('⚠️ No search results found');
            return [];
        }
        
        const trustedDomains = domain ? [domain] : ['cdc.gov', 'who.int', 'nejm.org', 'ncbi.nlm.nih.gov'];
        
        const links = data.items
            .filter(item => trustedDomains.some(d => item.link.includes(d)))
            .map(item => {
                // Extract metadata
                const metadata = item.pagemap || {};
                const metatags = metadata.metatags?.[0] || {};
                const citation = metadata.citation?.[0] || {};
                
                // Calculate relevance score
                const titleRelevance = calculateRelevance(query, item.title);
                const snippetRelevance = calculateRelevance(query, item.snippet || '');
                const dateBonus = metatags['article:published_time'] ? 0.2 : 0;
                const citationBonus = citation.author ? 0.3 : 0;
                const peerReviewedBonus = item.link.includes('pubmed') || item.link.includes('nejm.org') ? 0.3 : 0;
                
                const relevanceScore = Math.min(1, 
                    titleRelevance * 0.6 + 
                    snippetRelevance * 0.4 + 
                    dateBonus + 
                    citationBonus + 
                    peerReviewedBonus
                );
                
                return {
                    url: item.link,
                    title: item.title,
                    domain: domain || trustedDomains.find(d => item.link.includes(d)),
                    snippet: item.snippet,
                    publishedDate: metatags['article:published_time'] || citation.publicationDate,
                    authors: citation.author,
                    journal: citation.journal,
                    isPeerReviewed: item.link.includes('pubmed') || item.link.includes('nejm.org'),
                    relevanceScore
                };
            })
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
            
        console.log('📋 Processed links:', links);
        return links.slice(0, 3); // Return top 3 most relevant sources
    } catch (error) {
        console.error('❌ Error fetching source links:', error);
        return [];
    }
}

// Helper function to calculate text relevance
function calculateRelevance(query, text) {
    if (!text) return 0;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    // Calculate what percentage of query terms appear in the text
    const termMatches = queryTerms.filter(term => textLower.includes(term)).length;
    const termScore = termMatches / queryTerms.length;
    
    // Bonus for exact phrase match
    const phraseScore = textLower.includes(query.toLowerCase()) ? 0.3 : 0;
    
    // Bonus for scientific terms
    const scientificTerms = ['study', 'research', 'trial', 'analysis', 'evidence', 'data', 'findings'];
    const scientificScore = scientificTerms.some(term => textLower.includes(term)) ? 0.2 : 0;
    
    return Math.min(1, termScore + phraseScore + scientificScore);
}

async function fetchSources(claims) {
    const claimsList = claims.split('\n').filter(claim => claim.trim());
    const sources = {};

    // Process claims in parallel, but with rate limiting
    const BATCH_SIZE = 2; // Reduced batch size to avoid rate limiting
    for (let i = 0; i < claimsList.length; i += BATCH_SIZE) {
        const batch = claimsList.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async claim => {
            if (!claim.includes(':')) return null;

            const [topic, claimText] = claim.split(':', 2);
            console.log(`Fetching sources for claim: ${topic}`);

            try {
                // First try to find sources using the exact claim text
                const exactQuery = `"${claimText.trim()}" research evidence`;
                let foundSources = await searchAllDomains(exactQuery);

                // If no sources found, try with key terms from the claim
                if (foundSources.length === 0) {
                    // Extract key terms and create a more focused search query
                    const keyTerms = claimText
                        .toLowerCase()
                        .replace(/[^\w\s]/g, '')
                        .split(/\s+/)
                        .filter(word => word.length > 3 && !['this', 'that', 'than', 'what', 'when', 'where', 'which', 'while'].includes(word))
                        .slice(0, 5)
                        .join(' ');
                    
                    const broadQuery = `${keyTerms} ${topic} research evidence`;
                    foundSources = await searchAllDomains(broadQuery);
                }

                // If still no sources, try one last time with just the topic
                if (foundSources.length === 0) {
                    const topicQuery = `${topic} scientific evidence research`;
                    foundSources = await searchAllDomains(topicQuery);
                }

                sources[topic] = foundSources;
            } catch (error) {
                console.error(`Error fetching sources for '${topic}':`, error);
                sources[topic] = [];
            }
        });

        await Promise.all(batchPromises);

        // Add delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < claimsList.length) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    return sources;
}
