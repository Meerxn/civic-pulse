"""
Scrapes Seattle/King County government pages to build the RAG knowledge base.
Run once: python -m app.rag.scraper
Outputs raw text files to app/data/raw/
"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent / "data" / "raw"

SOURCES = [
    {
        "name": "seattle_business_license",
        "url": "https://www.seattle.gov/licenses",
    },
    {
        "name": "seattle_oed",
        "url": "https://www.seattle.gov/office-of-economic-development",
    },
    {
        "name": "seattle_food_truck_permit",
        "url": "https://www.seattle.gov/sdci/permits/common-projects/street-food-carts-or-trucks",
    },
    {
        "name": "seattle_new_business_permit",
        "url": "https://www.seattle.gov/sdci/permits/common-projects/new-businesses",
    },
    {
        "name": "kingcounty_permits",
        "url": "https://www.kingcounty.gov/permits",
    },
    {
        "name": "kingcounty_health",
        "url": "https://www.kingcounty.gov/health",
    },
    {
        "name": "wa_dor_open_business",
        "url": "https://dor.wa.gov/open-business",
    },
    {
        "name": "wa_dor_business_licensing",
        "url": "https://dor.wa.gov/business-licensing",
    },
    {
        "name": "wa_sos_corporations",
        "url": "https://sos.wa.gov/corporations-charities",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def clean_text(soup: BeautifulSoup) -> str:
    # Remove nav, footer, scripts, styles
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    # Collapse whitespace
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if len(line) > 20]
    return "\n".join(lines)


def scrape_url(name: str, url: str) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        text = clean_text(soup)
        print(f"  ✓ {name} ({len(text)} chars)")
        return text
    except Exception as e:
        print(f"  ✗ {name}: {e}")
        return None


def run():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for source in SOURCES:
        print(f"Scraping: {source['url']}")
        text = scrape_url(source["name"], source["url"])
        if text:
            out_path = BASE_DIR / f"{source['name']}.txt"
            out_path.write_text(text, encoding="utf-8")
            results.append({
                "name": source["name"],
                "url": source["url"],
                "path": str(out_path),
                "chars": len(text),
            })
        time.sleep(1)  # polite crawl delay

    print(f"\nScraped {len(results)}/{len(SOURCES)} sources → {BASE_DIR}")
    return results


if __name__ == "__main__":
    run()
