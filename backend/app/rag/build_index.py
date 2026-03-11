"""
Chunks raw scraped text, embeds with sentence-transformers, saves FAISS index.
Run once after scraper: python -m app.rag.build_index
"""

import json
import pickle
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
DATA_DIR = Path(__file__).parent.parent / "data"

INDEX_PATH = DATA_DIR / "faiss.index"
CHUNKS_PATH = DATA_DIR / "chunks.pkl"

CHUNK_SIZE = 400   # ~tokens (words)
CHUNK_OVERLAP = 60
EMBED_MODEL = "all-MiniLM-L6-v2"

# Map filename prefix → category for agent routing
CATEGORY_MAP = {
    "seattle_business_license": "business_permit",
    "seattle_oed": "business_permit",
    "seattle_food_truck_permit": "business_permit",
    "seattle_new_business_permit": "business_permit",
    "kingcounty_permits": "health_safety",
    "kingcounty_health": "health_safety",
    "wa_dor_open_business": "business_permit",
    "wa_dor_business_licensing": "business_permit",
    "wa_sos_corporations": "business_permit",
}

SOURCE_URL_MAP = {
    "seattle_business_license": "https://www.seattle.gov/licenses",
    "seattle_oed": "https://www.seattle.gov/office-of-economic-development",
    "seattle_food_truck_permit": "https://www.seattle.gov/sdci/permits/common-projects/street-food-carts-or-trucks",
    "seattle_new_business_permit": "https://www.seattle.gov/sdci/permits/common-projects/new-businesses",
    "kingcounty_permits": "https://www.kingcounty.gov/permits",
    "kingcounty_health": "https://www.kingcounty.gov/health",
    "wa_dor_open_business": "https://dor.wa.gov/open-business",
    "wa_dor_business_licensing": "https://dor.wa.gov/business-licensing",
    "wa_sos_corporations": "https://sos.wa.gov/corporations-charities",
}


def chunk_text(text: str, source_name: str) -> list[dict]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + CHUNK_SIZE, len(words))
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)
        chunks.append({
            "text": chunk_text,
            "source": source_name,
            "category": CATEGORY_MAP.get(source_name, "general"),
            "url": SOURCE_URL_MAP.get(source_name, ""),
        })
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def build():
    print(f"Loading embedding model: {EMBED_MODEL}")
    model = SentenceTransformer(EMBED_MODEL)

    all_chunks = []
    raw_files = list(RAW_DIR.glob("*.txt"))

    if not raw_files:
        print(f"No raw files found in {RAW_DIR}. Run scraper first.")
        return

    print(f"Chunking {len(raw_files)} documents...")
    for txt_file in raw_files:
        source_name = txt_file.stem
        text = txt_file.read_text(encoding="utf-8")
        chunks = chunk_text(text, source_name)
        all_chunks.extend(chunks)
        print(f"  {source_name}: {len(chunks)} chunks")

    print(f"\nEmbedding {len(all_chunks)} chunks...")
    texts = [c["text"] for c in all_chunks]
    embeddings = model.encode(texts, batch_size=64, show_progress_bar=True, normalize_embeddings=True)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner product (cosine after normalization)
    index.add(embeddings.astype(np.float32))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(INDEX_PATH))
    with open(CHUNKS_PATH, "wb") as f:
        pickle.dump(all_chunks, f)

    print(f"\n✓ FAISS index saved: {INDEX_PATH} ({index.ntotal} vectors, dim={dim})")
    print(f"✓ Chunks saved: {CHUNKS_PATH}")


if __name__ == "__main__":
    build()
