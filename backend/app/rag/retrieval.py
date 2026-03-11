"""
RAG retrieval module. Loads FAISS index once at startup and provides search.
"""

import pickle
from functools import lru_cache
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

DATA_DIR = Path(__file__).parent.parent / "data"
INDEX_PATH = DATA_DIR / "faiss.index"
CHUNKS_PATH = DATA_DIR / "chunks.pkl"
EMBED_MODEL = "all-MiniLM-L6-v2"


class RAGRetriever:
    def __init__(self):
        print("Loading FAISS index and embedding model...")
        self.model = SentenceTransformer(EMBED_MODEL)
        self.index = faiss.read_index(str(INDEX_PATH))
        with open(CHUNKS_PATH, "rb") as f:
            self.chunks = pickle.load(f)
        print(f"✓ RAG ready: {self.index.ntotal} vectors")

    def search(self, query: str, k: int = 6, category: str | None = None) -> list[dict]:
        """Return top-k relevant chunks, optionally filtered by category."""
        embedding = self.model.encode([query], normalize_embeddings=True).astype(np.float32)
        scores, indices = self.index.search(embedding, k * 3)  # over-fetch then filter

        results = []
        seen_sources = set()
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            chunk = self.chunks[idx]
            if category and chunk["category"] != category:
                continue
            # Deduplicate by source (keep top chunk per source)
            if chunk["source"] in seen_sources:
                continue
            seen_sources.add(chunk["source"])
            results.append({**chunk, "score": float(score)})
            if len(results) >= k:
                break

        return results


_retriever: RAGRetriever | None = None


def get_retriever() -> RAGRetriever:
    global _retriever
    if _retriever is None:
        _retriever = RAGRetriever()
    return _retriever
