"""
RAG retrieval module. Loads chunks once at startup, builds a BM25 index for keyword search.
"""

import pickle
from pathlib import Path

from rank_bm25 import BM25Okapi

DATA_DIR = Path(__file__).parent.parent / "data"
CHUNKS_PATH = DATA_DIR / "chunks.pkl"


class RAGRetriever:
    def __init__(self):
        print("Loading chunks and building BM25 index...")
        with open(CHUNKS_PATH, "rb") as f:
            self.chunks = pickle.load(f)

        tokenized = [c["text"].lower().split() for c in self.chunks]
        self.bm25 = BM25Okapi(tokenized)
        print(f"✓ RAG ready: {len(self.chunks)} chunks")

    def search(self, query: str, k: int = 6, category: str | None = None) -> list[dict]:
        """Return top-k relevant chunks, optionally filtered by category."""
        tokens = query.lower().split()
        scores = self.bm25.get_scores(tokens)

        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

        results = []
        seen_sources = set()
        for idx in ranked:
            if len(results) >= k:
                break
            chunk = self.chunks[idx]
            if category and chunk["category"] != category:
                continue
            if chunk["source"] in seen_sources:
                continue
            seen_sources.add(chunk["source"])
            results.append({**chunk, "score": float(scores[idx])})

        return results


_retriever: RAGRetriever | None = None


def get_retriever() -> RAGRetriever:
    global _retriever
    if _retriever is None:
        _retriever = RAGRetriever()
    return _retriever
