#!/usr/bin/env python3
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber

HEBREW_PAGES = range(7, 106)
SCIENTIFIC_PAGES = range(109, 211)

def clean(value):
    return re.sub(r"\s+", " ", (value or "").replace("\n", " ").strip())

def reverse_hebrew_cell(value):
    return clean(value)[::-1]

def extract(pdf_path, pages):
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number in pages:
            tables = pdf.pages[page_number - 1].extract_tables()
            if not tables:
                raise RuntimeError(f"No table found on PDF page {page_number}")
            table = max(tables, key=len)
            if len(table) < 2:
                continue
            for row in table[1:]:
                if not row or len(row) < 6:
                    continue
                hebrew, scientific, hybrid, family_he, family_sci, growth = row[:6]
                if not clean(hebrew) and not clean(scientific):
                    continue
                rows.append({
                    "hebrewName": reverse_hebrew_cell(hebrew),
                    "scientificName": clean(scientific),
                    "familyHebrew": reverse_hebrew_cell(family_he),
                    "familyScientific": clean(family_sci),
                    "growthForm": reverse_hebrew_cell(growth),
                    "hybrid": reverse_hebrew_cell(hybrid) == "מכלוא",
                    "sourcePage": page_number,
                })
    return rows

def pair_key(item):
    return (
        re.sub(r"\s+", " ", item["hebrewName"].strip().lower()).replace("×", "x"),
        re.sub(r"\s+", " ", item["scientificName"].strip().lower()).replace("×", "x"),
    )

def dedupe(rows):
    seen = set()
    result = []
    for item in rows:
        key = (
            item["hebrewName"],
            item["scientificName"],
            item["familyHebrew"],
            item["familyScientific"],
            item["growthForm"],
            item["hybrid"],
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_ornamental_plants.py input.pdf output.json")

    pdf_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    hebrew_rows = extract(pdf_path, HEBREW_PAGES)
    scientific_rows = extract(pdf_path, SCIENTIFIC_PAGES)

    if len(hebrew_rows) != len(scientific_rows):
        raise RuntimeError(
            f"Cross-check failed: Hebrew list has {len(hebrew_rows)} rows, "
            f"scientific list has {len(scientific_rows)} rows"
        )

    hebrew_pairs = Counter(pair_key(x) for x in hebrew_rows)
    scientific_pairs = Counter(pair_key(x) for x in scientific_rows)
    overlap = sum((hebrew_pairs & scientific_pairs).values())
    mismatch = len(hebrew_rows) - overlap

    # The PDF contains a handful of typographic spacing differences in Hebrew
    # between the two independently sorted copies. A small mismatch is expected.
    if mismatch > 20:
        raise RuntimeError(
            f"Cross-check failed: {mismatch} rows differ between the two PDF indexes"
        )

    final_rows = dedupe(hebrew_rows)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(final_rows, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    report = {
        "rowsExtracted": len(hebrew_rows),
        "rowsAfterExactDeduplication": len(final_rows),
        "crossCheckExactPairMatches": overlap,
        "crossCheckDifferences": mismatch,
        "source": "Israel Ministry of Agriculture, List of the Ornamental Plants in Israel, 2017",
    }
    report_path = output_path.with_suffix(".report.json")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
