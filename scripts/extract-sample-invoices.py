#!/usr/bin/env python3
"""Extract structured sample invoice data from known supplier PDF layouts."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import pdfplumber


DEFAULT_INPUT_DIR = Path("/Users/svendneumann/Desktop/Materialwirtschaft/1. Beispielrechnungen")


@dataclass
class InvoiceItem:
    article_no: str
    description: str
    quantity: float
    unit_price: float
    line_total: float
    confidence: float


@dataclass
class InvoiceSummary:
    file: str
    supplier: str
    document_type: str
    invoice_no: str | None
    invoice_date: str | None
    customer_no: str | None
    location_name: str | None
    location_address: str | None
    net_total: float | None
    vat_total: float | None
    gross_total: float | None
    freight_total: float | None
    surcharge_total: float | None
    pages: int
    extracted_items: int
    sample_items: list[InvoiceItem]
    warnings: list[str]


LOCATION_RULES = [
    ("Kehl", [r"77694\s+Kehl", r"Rheinstr\.\s*46"]),
    ("Kirchberg", [r"08107\s+Kirchberg", r"Auerbacher\s+Str\.\s*13"]),
    ("Essen Zollverein", [r"45327\s+Essen", r"Viktoriastra(?:ße|sse)\s+41a", r"Zeche\s+Zollverein"]),
    ("Hüttenberg", [r"35625\s+H[üu]ttenberg", r"Langg[öo]nser\s+Str\.\s*29"]),
]


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    cleaned = value.strip().replace(".", "").replace(",", ".").replace("€", "")
    negative = cleaned.endswith("-") or cleaned.startswith("-")
    cleaned = cleaned.strip("-")
    try:
        amount = float(cleaned)
        return -amount if negative else amount
    except ValueError:
        return None


def read_pdf_text(path: Path) -> tuple[str, int]:
    with pdfplumber.open(path) as pdf:
        pages = len(pdf.pages)
        text = "\n".join(page.extract_text(x_tolerance=1, y_tolerance=3) or "" for page in pdf.pages)
    return text, pages


def supplier_for(text: str) -> str:
    if "Henry Schein Dental Deutschland" in text:
        return "Henry Schein"
    if "Plandent GmbH" in text:
        return "Plandent"
    if "Monatsrechnung Blatt" in text and "Kundennummer 312075" in text:
        return "GERL"
    return "Unbekannt"


def document_type_for(text: str, supplier: str) -> str:
    if "Gutschrift" in text and supplier == "Plandent":
        return "Gutschrift"
    if supplier == "GERL":
        return "Monatsrechnung"
    return "Rechnung"


def location_for(text: str) -> tuple[str | None, str | None]:
    for name, patterns in LOCATION_RULES:
        if any(re.search(pattern, text, re.I) for pattern in patterns):
            address = address_near_location(text, patterns)
            return name, address
    return None, None


def address_near_location(text: str, patterns: list[str]) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        if any(re.search(pattern, line, re.I) for pattern in patterns):
            start = max(0, index - 3)
            end = min(len(lines), index + 1)
            return ", ".join(lines[start:end])
    return None


def extract_common_totals(text: str, supplier: str) -> tuple[float | None, float | None, float | None, float | None, float | None]:
    net_total = vat_total = gross_total = freight_total = surcharge_total = None
    if supplier == "Plandent":
        net_total = last_amount(text, r"Zwischensumme\s+(-?[\d.]+,\d{2})")
        gross_total = last_amount(text, r"Gesamtsumme\s+(-?[\d.]+,\d{2})")
        vat_total = last_amount(text, r"19\s*%\s*MwSt\s+auf\s+-?[\d.]+,\d{2}\s+(-?[\d.]+,\d{2})")
        surcharge_total = last_amount(text, r"Mindermenge\s+Inland\s+(-?[\d.]+,\d{2})")
    elif supplier == "Henry Schein":
        net_total = last_amount(text, r"Summe\s+Positionen\s+(-?[\d.]+,\d{2})")
        freight_total = last_amount(text, r"Versandkosten\s+\d*\s*(-?[\d.]+,\d{2})")
        vat_total = last_amount(text, r"Mehrwertsteuer\s+\d+\s+-?[\d.]+,\d{2}\s+19,00\s*%\s+(-?[\d.]+,\d{2})")
        gross_total = last_amount(text, r"Endbetrag\s+(-?[\d.]+,\d{2})")
    elif supplier == "GERL":
        gerl_total = re.findall(
            r"Ne-Warenwert\s+MS\s+MwSt\s+%\s+MwSt\s+Re-Betrag\s+EUR\s+(-?[\d.]+,\d{2})\s+\d+\s+19,00\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})",
            text,
            re.I,
        )
        if gerl_total:
            net_total, vat_total, gross_total = (to_float(value) for value in gerl_total[-1])
    return net_total, vat_total, gross_total, freight_total, surcharge_total


def last_amount(text: str, pattern: str) -> float | None:
    matches = re.findall(pattern, text, re.I)
    return to_float(matches[-1]) if matches else None


def extract_header(text: str, supplier: str) -> tuple[str | None, str | None, str | None]:
    if supplier == "Henry Schein":
        return (
            first_match(text, r"Rechnung\s+(\d{6,})"),
            first_match(text, r"Datum:\s*(\d{2}\.\d{2}\.\d{4})"),
            first_match(text, r"Kundennummer:\s*(\d+)"),
        )
    if supplier == "Plandent":
        return (
            first_match(text, r"(?:Rechnungs|Gutschrifts)-Nr\.:\s*(\d+)"),
            first_match(text, r"Datum:\s*(\d{2}\.\d{2}\.\d{4})"),
            first_match(text, r"Kunden-Nr\.:\s*(\d+)"),
        )
    if supplier == "GERL":
        return (
            first_match(text, r"Nummer\s+(\d{8,})"),
            first_match(text, r"Datum\s+(\d{2}\.\d{2}\.\d{4})"),
            first_match(text, r"Kundennummer\s+(\d+)"),
        )
    return None, None, None


def first_match(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.I)
    return match.group(1) if match else None


def extract_items(text: str, supplier: str) -> list[InvoiceItem]:
    if supplier == "Plandent":
        pattern = re.compile(r"^\s*\d+\s+(\d{5,})\s+(.+?)\s+(-?\d+(?:,\d+)?)\s+([\d.]+,\d{2})\*?\s+([\d.]+,\d{2})\*?\s+(-?[\d.]+,\d{2})", re.M)
    elif supplier == "Henry Schein":
        pattern = re.compile(r"^\s*(\d{5,})\s+(-?\d+)\s+(.+?)\s+\d(?:,\s*\d)*(?:,\s*\d)?\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2})", re.M)
    elif supplier == "GERL":
        pattern = re.compile(r"^\s*(\d{4,})\s+(.+?)\s+(\d+-?)\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2}-?)\s+[A-Z]\s+\d", re.M)
    else:
        return []

    items: list[InvoiceItem] = []
    for match in pattern.finditer(text):
        if supplier == "Plandent":
            article_no, description, qty, _list_price, unit_price, total = match.groups()
        elif supplier == "Henry Schein":
            article_no, qty, description, unit_price, total = match.groups()
        else:
            article_no, description, qty, unit_price, total = match.groups()
        quantity = to_float(qty.replace(",", ".")) or 0
        items.append(
            InvoiceItem(
                article_no=article_no,
                description=re.sub(r"\s+", " ", description).strip(),
                quantity=quantity,
                unit_price=to_float(unit_price) or 0,
                line_total=to_float(total) or 0,
                confidence=0.88 if supplier != "Henry Schein" else 0.78,
            )
        )
    return items


def summarize(path: Path) -> InvoiceSummary:
    text, pages = read_pdf_text(path)
    supplier = supplier_for(text)
    invoice_no, invoice_date, customer_no = extract_header(text, supplier)
    location_name, location_address = location_for(text)
    net_total, vat_total, gross_total, freight_total, surcharge_total = extract_common_totals(text, supplier)
    items = extract_items(text, supplier)
    warnings = []
    if supplier == "Unbekannt":
        warnings.append("Lieferantenprofil nicht erkannt")
    if not location_name:
        warnings.append("Standort konnte nicht aus Anschrift abgeleitet werden")
    if not gross_total:
        warnings.append("Bruttosumme nicht sicher erkannt")
    if len(items) == 0:
        warnings.append("Keine Positionszeilen erkannt")
    return InvoiceSummary(
        file=path.name,
        supplier=supplier,
        document_type=document_type_for(text, supplier),
        invoice_no=invoice_no,
        invoice_date=invoice_date,
        customer_no=customer_no,
        location_name=location_name,
        location_address=location_address,
        net_total=net_total,
        vat_total=vat_total,
        gross_total=gross_total,
        freight_total=freight_total,
        surcharge_total=surcharge_total,
        pages=pages,
        extracted_items=len(items),
        sample_items=items[:8],
        warnings=warnings,
    )


def invoice_paths(input_dir: Path) -> Iterable[Path]:
    yield from sorted(input_dir.glob("*.PDF"))
    yield from sorted(input_dir.glob("*.pdf"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output", type=Path, default=Path("data/sample-invoice-imports.json"))
    args = parser.parse_args()

    summaries = [asdict(summarize(path)) for path in invoice_paths(args.input_dir)]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summaries, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summaries, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
