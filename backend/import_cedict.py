"""Importa o arquivo CC-CEDICT (UTF-8) para o banco SQLite do zhsub."""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

DATABASE_PATH = Path(__file__).with_name("zhsub.db")
ENTRY = re.compile(r"^(?P<traditional>\S+)\s+(?P<simplified>\S+)\s+\[(?P<pinyin>[^]]*)\]\s+/(?P<definitions>.*)/$")


def main(source: str) -> None:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.executescript(
        """
        DROP TABLE IF EXISTS entries;
        CREATE TABLE entries (
            traditional TEXT NOT NULL,
            simplified TEXT NOT NULL,
            pinyin TEXT NOT NULL,
            definitions TEXT NOT NULL
        );
        CREATE INDEX entries_simplified ON entries(simplified);
        CREATE INDEX entries_traditional ON entries(traditional);
        """
    )
    inserted = 0
    with open(source, encoding="utf-8") as dictionary:
        for line in dictionary:
            if line.startswith("#"):
                continue
            match = ENTRY.match(line.strip())
            if not match:
                continue
            definitions = [item for item in match["definitions"].split("/") if item]
            connection.execute(
                "INSERT INTO entries VALUES (?, ?, ?, ?)",
                (match["traditional"], match["simplified"], match["pinyin"], json.dumps(definitions, ensure_ascii=False)),
            )
            inserted += 1
    connection.commit()
    connection.close()
    print(f"{inserted} entradas importadas em {DATABASE_PATH}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python import_cedict.py caminho/para/cedict.txt")
    main(sys.argv[1])
