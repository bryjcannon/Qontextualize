import openai
import re
import requests
from bs4 import BeautifulSoup

def extract_claims(transcript):
    """Extracts strong claims from the transcript."""
    prompt = f"""
    Given the following transcript:
    {transcript}
    Identify strong claims, especially scientific or technical in nature. 
    List each claim separately along with any sources mentioned.
    """
    response = openai.ChatCompletion.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
    return response["choices"][0]["message"]["content"]

def verify_claims(claims):
    """Verifies claims against scientific consensus."""
    prompt = f"""
    Given the following list of claims:
    {claims}
    Compare each claim with established scientific literature and consensus.
    Provide an accuracy assessment for each claim along with links to relevant sources.
    """
    response = openai.ChatCompletion.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
    return response["choices"][0]["message"]["content"]

def extract_timestamps(transcript, claims):
    """Finds timestamps in the transcript where each claim was discussed."""
    timestamps = {}
    for claim in claims.split('\n'):
        keyword = claim.split(':')[0]  # Extract main topic
        timestamps[keyword] = []
        for line in transcript.split('\n'):
            if any(word.lower() in line.lower() for word in keyword.split()):
                match = re.search(r'(\d{2}:\d{2}:\d{2})', line)
                if match:
                    timestamps[keyword].append(match.group(0))
    return timestamps

def fetch_source_links(query):
    """Searches for authoritative sources online."""
    search_url = f"https://www.google.com/search?q={query} site:cdc.gov OR site:who.int OR site:epa.gov OR site:nejm.org OR site:ncbi.nlm.nih.gov"
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(search_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    links = []
    for link in soup.find_all('a', href=True):
        href = link['href']
        if "http" in href and not "google" in href:
            links.append(href)
    return links[:3]  # Return top 3 sources

def generate_final_report(transcript):
    """Generates a final structured report from the transcript."""
    claims = extract_claims(transcript)
    verified_claims = verify_claims(claims)
    timestamps = extract_timestamps(transcript, claims)
    
    report = "# Video Claim Analysis Report\n\n"
    report += "## Strong Claims and Their Evaluation\n\n"
    
    for claim in claims.split('\n'):
        if claim.strip():
            topic = claim.split(':')[0]
            sources = fetch_source_links(topic)
            
            report += f"### {topic}\n"
            report += f"**Claim:** {claim}\n\n"
            report += f"**Timestamps:** {timestamps.get(topic, ['N/A'])}\n\n"
            report += f"**Verification:** {verified_claims}\n\n"
            report += "**Relevant Sources:**\n"
            for source in sources:
                report += f"- [{source}]({source})\n"
            report += "\n---\n"
    
    return report

# Example usage
transcript_text = """Insert transcript text here"""
final_report = generate_final_report(transcript_text)
print(final_report)
