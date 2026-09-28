"""API local do zhsub para consultar e segmentar legendas chinesas."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DATABASE_PATH = Path(__file__).with_name("zhsub.db")

app = FastAPI(title="zhsub API", version="0.1.0")
# A API fica restrita a 127.0.0.1 pelo comando de inicialização documentado.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class SegmentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@contextmanager
def database():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def entry_dict(row: sqlite3.Row) -> dict:
    return {
        "traditional": row["traditional"],
        "simplified": row["simplified"],
        "pinyin": row["pinyin"],
        "definitions": json.loads(row["definitions"]),
    }


def find_entry(connection: sqlite3.Connection, word: str):
    return connection.execute(
        """
        SELECT traditional, simplified, pinyin, definitions
        FROM entries
        WHERE simplified = ? OR traditional = ?
        LIMIT 1
        """,
        (word, word),
    ).fetchone()


@app.get("/health")
def health():
    return {"status": "ok", "dictionary_loaded": DATABASE_PATH.exists()}


@app.get("/lookup")
def lookup(word: str):
    with database() as connection:
        row = find_entry(connection, word)
    if row is None:
        raise HTTPException(status_code=404, detail="Palavra não encontrada")
    return entry_dict(row)


@app.post("/segment")
def segment(request: SegmentRequest):
    if not DATABASE_PATH.exists():
        raise HTTPException(status_code=503, detail="Dicionário ainda não foi importado")

    tokens = []
    with database() as connection:
        max_length = connection.execute(
            """
            SELECT MAX(
                CASE WHEN length(simplified) > length(traditional)
                THEN length(simplified) ELSE length(traditional) END
            ) FROM entries
            """
        ).fetchone()[0] or 1
        position = 0
        while position < len(request.text):
            chosen_word, chosen_entry = None, None
            for length in range(min(max_length, len(request.text) - position), 0, -1):
                candidate = request.text[position : position + length]
                row = find_entry(connection, candidate)
                if row is not None:
                    chosen_word, chosen_entry = candidate, row
                    break
            if chosen_entry is None:
                tokens.append({"text": request.text[position], "start": position, "end": position + 1, "entry": None})
                position += 1
            else:
                tokens.append({"text": chosen_word, "start": position, "end": position + len(chosen_word), "entry": entry_dict(chosen_entry)})
                position += len(chosen_word)
    return {"tokens": tokens}
