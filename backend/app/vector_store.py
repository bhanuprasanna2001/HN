"""ChromaDB vector store for semantic search over KB articles, scripts, and tickets."""

from __future__ import annotations

import logging
from typing import Any

import chromadb

logger = logging.getLogger(__name__)

# Collection names
COL_KB = "kb_articles"
COL_SCRIPTS = "scripts"
COL_TICKETS = "tickets"

BATCH_SIZE = 500


class VectorStore:
    """Wraps ChromaDB for indexing and retrieval."""

    def __init__(self, persist_dir: str) -> None:
        logger.info("Initializing ChromaDB at %s", persist_dir)
        self.client = chromadb.PersistentClient(path=persist_dir)
        self._collections: dict[str, chromadb.Collection] = {}

    def _get_or_create(self, name: str) -> chromadb.Collection:
        if name not in self._collections:
            self._collections[name] = self.client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collections[name]

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    def index_kb_articles(self, articles: list[dict[str, Any]]) -> int:
        """Index knowledge-base articles. Returns count indexed."""
        col = self._get_or_create(COL_KB)
        if col.count() > 0:
            logger.info("KB collection already populated (%d docs), skipping.", col.count())
            return col.count()

        docs, ids, metas = [], [], []
        for art in articles:
            aid = art.get("KB_Article_ID", "")
            if not aid:
                continue
            text = f"{art.get('Title', '')}\n{art.get('Body', '')}"
            if not text.strip():
                continue
            docs.append(text[:8000])
            ids.append(aid)
            metas.append({
                "title": str(art.get("Title", ""))[:500],
                "module": str(art.get("Module", "")),
                "category": str(art.get("Category", "")),
                "source_type": str(art.get("Source_Type", "")),
                "doc_type": "kb_article",
            })

        return self._batch_add(col, ids, docs, metas, "KB articles")

    def index_scripts(self, scripts: list[dict[str, Any]]) -> int:
        """Index Tier-3 scripts. Returns count indexed."""
        col = self._get_or_create(COL_SCRIPTS)
        if col.count() > 0:
            logger.info("Scripts collection already populated (%d docs), skipping.", col.count())
            return col.count()

        docs, ids, metas = [], [], []
        for sc in scripts:
            sid = sc.get("Script_ID", "")
            if not sid:
                continue
            text = (
                f"{sc.get('Script_Title', '')}\n"
                f"Purpose: {sc.get('Script_Purpose', '')}\n"
                f"Inputs: {sc.get('Script_Inputs', '')}\n"
                f"Module: {sc.get('Module', '')} / {sc.get('Category', '')}"
            )
            docs.append(text[:8000])
            ids.append(sid)
            metas.append({
                "title": str(sc.get("Script_Title", ""))[:500],
                "module": str(sc.get("Module", "")),
                "category": str(sc.get("Category", "")),
                "doc_type": "script",
            })

        return self._batch_add(col, ids, docs, metas, "scripts")

    def index_tickets(self, tickets: list[dict[str, Any]]) -> int:
        """Index resolved tickets. Returns count indexed."""
        col = self._get_or_create(COL_TICKETS)
        if col.count() > 0:
            logger.info("Tickets collection already populated (%d docs), skipping.", col.count())
            return col.count()

        docs, ids, metas = [], [], []
        for tk in tickets:
            tid = tk.get("Ticket_Number", "")
            if not tid:
                continue
            text = (
                f"Subject: {tk.get('Subject', '')}\n"
                f"Description: {tk.get('Description', '')}\n"
                f"Resolution: {tk.get('Resolution', '')}\n"
                f"Root Cause: {tk.get('Root_Cause', '')}"
            )
            docs.append(text[:8000])
            ids.append(tid)
            metas.append({
                "title": str(tk.get("Subject", ""))[:500],
                "module": str(tk.get("Module", "")),
                "category": str(tk.get("Category", "")),
                "tier": str(tk.get("Tier", "")),
                "status": str(tk.get("Status", "")),
                "doc_type": "ticket",
            })

        return self._batch_add(col, ids, docs, metas, "tickets")

    def _batch_add(
        self,
        col: chromadb.Collection,
        ids: list[str],
        docs: list[str],
        metas: list[dict],
        label: str,
    ) -> int:
        """Add documents in batches to avoid memory issues."""
        total = len(ids)
        for start in range(0, total, BATCH_SIZE):
            end = min(start + BATCH_SIZE, total)
            col.add(
                ids=ids[start:end],
                documents=docs[start:end],
                metadatas=metas[start:end],
            )
            logger.info("  Indexed %s %d/%d", label, end, total)
        return total

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        collections: list[str] | None = None,
        top_k: int = 5,
        where: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Search across one or more collections. Returns unified ranked results."""
        if collections is None:
            collections = [COL_KB, COL_SCRIPTS, COL_TICKETS]

        all_results: list[dict[str, Any]] = []

        for col_name in collections:
            col = self._get_or_create(col_name)
            if col.count() == 0:
                continue

            kwargs: dict[str, Any] = {
                "query_texts": [query],
                "n_results": min(top_k, col.count()),
            }
            if where:
                kwargs["where"] = where

            results = col.query(**kwargs)

            for i in range(len(results["ids"][0])):
                dist = results["distances"][0][i] if results.get("distances") else 1.0
                score = max(0.0, 1.0 - dist)
                meta = results["metadatas"][0][i] if results.get("metadatas") else {}
                doc = results["documents"][0][i] if results.get("documents") else ""
                all_results.append({
                    "id": results["ids"][0][i],
                    "doc_type": meta.get("doc_type", col_name),
                    "title": meta.get("title", ""),
                    "snippet": doc[:500],
                    "score": round(score, 4),
                    "metadata": meta,
                })

        all_results.sort(key=lambda x: x["score"], reverse=True)
        return all_results[:top_k]

    def add_kb_article(self, article_id: str, text: str, metadata: dict) -> None:
        """Add a single KB article to the index (for self-learning loop)."""
        col = self._get_or_create(COL_KB)
        col.add(
            ids=[article_id],
            documents=[text[:8000]],
            metadatas=[metadata],
        )
        logger.info("Added new KB article %s to index", article_id)
