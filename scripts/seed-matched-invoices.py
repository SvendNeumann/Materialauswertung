#!/usr/bin/env python3
"""Build matched invoice analysis data from the known PDF samples and seed Supabase."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from statistics import mean


ROOT = Path(__file__).resolve().parents[1]
EXTRACTOR_PATH = ROOT / "scripts" / "extract-sample-invoices.py"
SUPABASE_URL = "https://rxiboswudbunvjqgpnyc.supabase.co"
SUPABASE_KEY = "sb_publishable__KobDxUjq-p0hIBzG62Fbw_OlGngnvY"
seed_warnings: list[str] = []


spec = importlib.util.spec_from_file_location("extract_sample_invoices", EXTRACTOR_PATH)
extractor = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = extractor
spec.loader.exec_module(extractor)


CATEGORY_RULES = [
    ("Verbrauchsmaterial", ["kanül", "kanu", "nadel", "septoject", "orbiject", "sopira", "absaug", "speichelsauger"]),
    ("Hygiene", ["handtuch", "handtücher", "tork", "sterifolie", "sterireel", "desinf", "sept", "clean"]),
    ("Füllung", ["komposit", "composite", "filtek", "tetric", "clip spritze", "easy match", "bond", "panavia"]),
    ("Prophylaxe", ["prophy", "polierpaste", "flairesse"]),
    ("Prothetik", ["mischkan", "penta misch", "anmisch", "impregum", "omnibite", "abform", "biss"]),
    ("Endodontie", ["feilen", "reciproc", "mtwo", "profile"]),
    ("Praxislabor", ["zirconia", "zircad", "emax", "block", "bohrer", "bur ", "fräser", "pmma", "zro2"]),
]

AUTO_MATCH_RULES = [
    {
        "key": "ledermix-paste-5g",
        "name": "Ledermix Paste Tube 5 g",
        "category": "Endodontie",
        "patterns": [r"\bledermix\b.*\bpaste\b.*\b(?:tube\b)?.*\b5\s*g\b"],
    },
    {
        "key": "penta-mischkanuelen-50",
        "name": "Penta Mischkanülen 50 St",
        "category": "Prothetik",
        "patterns": [r"\bpenta\b.*\bmischkan[üu]len\b.*(?:50|pack\s*50)"],
    },
    {
        "key": "optragate-2-small",
        "name": "OptraGate 2 Small",
        "category": "Verbrauchsmaterial",
        "patterns": [r"\boptragate\b.*\b2\b.*\bsmall\b"],
    },
    {
        "key": "eddy-irrigation-tip-10",
        "name": "EDDY Irrigation Tips 10 St",
        "category": "Endodontie",
        "patterns": [r"\beddy\b.*(?:irrigation|sp[üu]lkan[üu]len).*(?:10|5\s*x\s*2)"],
    },
    {
        "key": "activator-universal-plus-paste-60ml",
        "name": "Activator Universal Plus Paste 60 ml",
        "category": "Prothetik",
        "patterns": [r"\bactivator\b.*\buniversal\b.*\bplus\b.*\bpaste\b"],
    },
]

REVIEW_PATTERNS = [
    (r"\bketac\b.*\b(?:cem|univ|universal|aplicap)\b", "Ketac-Variante mit Herstellerdaten prüfen"),
    (r"\bmiraject\b.*\bluer\b", "Miraject-Kanülenvariante prüfen"),
    (r"\btemp\s*bond\b.*\bautomix\b", "TempBond-Variante prüfen"),
    (r"\btetric\b.*\b(?:evoflow|evoceram)\b", "Tetric-Materialvariante prüfen"),
]


def normalize_text(value: str) -> str:
    text = value.casefold()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = re.sub(r"\b\d+(?:[,.]\d+)?\s*(?:mm|cm|ml|g|kg|st|stck|stk|x)\b", " ", text)
    text = re.sub(r"\b\d+(?:[,.]\d+)?\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def category_for(description: str) -> str:
    normalized = normalize_text(description)
    for category, terms in CATEGORY_RULES:
        if any(term in normalized for term in terms):
            return category
    if any(term in normalized for term in ["handschuh", "becher", "tuch", "maske"]):
        return "Praxisbedarf"
    if any(term in normalized for term in ["implant", "schraube", "magnet"]):
        return "Implantologie"
    return "Material"


def normalized_for_rules(value: str) -> str:
    text = value.casefold()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = text.replace("®", "")
    return re.sub(r"\s+", " ", text).strip()


def auto_match_rule(description: str) -> dict | None:
    original = description.casefold().replace("®", "")
    normalized = normalized_for_rules(description)
    for rule in AUTO_MATCH_RULES:
        if any(re.search(pattern, original, re.I) or re.search(pattern, normalized, re.I) for pattern in rule["patterns"]):
            return rule
    return None


def needs_review(description: str) -> str | None:
    original = description.casefold().replace("®", "")
    normalized = normalized_for_rules(description)
    for pattern, reason in REVIEW_PATTERNS:
        if re.search(pattern, original, re.I) or re.search(pattern, normalized, re.I):
            return reason
    return None


def catalog_key(description: str) -> str:
    text = description.casefold()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = text.replace("stck", "st").replace("stk", "st").replace("stück", "st")
    text = re.sub(r"([a-z])[-_/](?=[a-z0-9])", r"\1 ", text)
    text = re.sub(r"(?<=\d),(?=\d)", ".", text)
    text = re.sub(r"[^a-z0-9.]+", " ", text)
    tokens = [token for token in text.split() if token not in {"pa", "pack", "packung", "fl", "refill"}]
    return " ".join(tokens[:10]) or re.sub(r"\W+", "", description.casefold()) or "artikel"


def match_key(item: dict) -> tuple[str, str, str, float]:
    rule = auto_match_rule(item["description"])
    if rule:
        stable_id = hashlib.sha1(rule["key"].encode("utf-8")).hexdigest()[:12].upper()
        return f"G-{stable_id}", rule["name"], rule["category"], 0.97

    review_reason = needs_review(item["description"])
    key = catalog_key(item["description"])
    stable_id = hashlib.sha1(key.encode("utf-8")).hexdigest()[:12].upper()
    score = 0.82 if review_reason else 0.94
    return f"P-{stable_id}", item["description"][:64], category_for(item["description"]), score


def parse_decimal(value: str) -> float:
    return float(value.replace(".", "").replace(",", "."))


def pack_basis(description: str) -> tuple[float, str, str]:
    text = description.casefold().replace("stck", "st").replace("stk", "st")
    text = text.replace("stück", "st")

    multi = re.search(r"(\d+)\s*x\s*(\d+(?:[,.]\d+)?)\s*(ml|g|kg|l|st)\b", text)
    if multi:
        count = int(multi.group(1))
        amount = parse_decimal(multi.group(2))
        unit = multi.group(3)
        factor = count * amount
        if unit == "kg":
            return factor * 1000, "g", f"{count} x {amount:g} kg"
        if unit == "l":
            return factor * 1000, "ml", f"{count} x {amount:g} l"
        return max(factor, 1), "Stück" if unit == "st" else unit, f"{count} x {amount:g} {unit}"

    pieces = re.search(r"(?:pa|p|pack|packung)\s*\.?\s*(\d+)\s*(?:st)?\b", text)
    if pieces:
        amount = int(pieces.group(1))
        if amount > 1:
            return amount, "Stück", f"{amount} St"

    pieces = re.search(r"\b(\d+)\s*st\b", text)
    if pieces:
        amount = int(pieces.group(1))
        if amount > 1:
            return amount, "Stück", f"{amount} St"

    amount_match = re.search(r"\b(\d+(?:[,.]\d+)?)\s*(ml|g|kg|l)\b", text)
    if amount_match:
        amount = parse_decimal(amount_match.group(1))
        unit = amount_match.group(2)
        if unit == "kg":
            return amount * 1000, "g", f"{amount:g} kg"
        if unit == "l":
            return amount * 1000, "ml", f"{amount:g} l"
        if amount > 0:
            return amount, unit, f"{amount:g} {unit}"

    return 1, "Einheit", "1 Einheit"


def catalog_pack_override(item: dict, pack_factor: float, unit: str, pack_note: str) -> tuple[float, str, str]:
    if pack_factor != 1 or unit != "Einheit":
        return pack_factor, unit, pack_note

    rule = auto_match_rule(item["description"])
    if not rule:
        return pack_factor, unit, pack_note

    if rule["key"] == "optragate-2-small":
        return 80, "Stück", "80 St (Katalogbasis)"
    if rule["key"] == "activator-universal-plus-paste-60ml":
        return 60, "ml", "60 ml (Katalogbasis)"
    return pack_factor, unit, pack_note


def iso_date(value: str | None) -> str:
    if not value:
        return ""
    return datetime.strptime(value, "%d.%m.%Y").date().isoformat()


def invoice_id(summary: dict) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "-", summary["invoice_no"] or summary["file"]).strip("-")
    return f"INV-{safe}"


def item_discount(item: dict) -> float:
    gross_line = item["quantity"] * item["unit_price"]
    if not gross_line:
        return 0.0
    discount = 1 - (item["line_total"] / gross_line)
    if math.isnan(discount) or math.isinf(discount):
        return 0.0
    return max(0.0, min(0.65, discount))


def build_payload(input_dir: Path) -> dict:
    summaries = [asdict(extractor.summarize(path)) for path in extractor.invoice_paths(input_dir)]
    products_by_id: dict[str, dict] = {}
    invoice_rows = []
    item_rows = []
    supplier_price_values = defaultdict(list)

    for summary in summaries:
        inv_id = invoice_id(summary)
        invoice_rows.append({
            "id": inv_id,
            "invoice_no": summary["invoice_no"] or summary["file"],
            "invoice_date": iso_date(summary["invoice_date"]),
            "supplier_name": summary["supplier"],
            "location_name": summary["location_name"],
            "status": "Freigegeben",
            "net": summary["net_total"] or 0,
            "freight": summary["freight_total"] or 0,
            "surcharge": summary["surcharge_total"] or 0,
            "discount": 0,
            "skonto_used": False,
        })
        for item in summary["items"]:
            product_id, product_name, category, score = match_key(item)
            pack_factor, unit, pack_note = pack_basis(item["description"])
            pack_factor, unit, pack_note = catalog_pack_override(item, pack_factor, unit, pack_note)
            products_by_id.setdefault(product_id, {
                "id": product_id,
                "name": product_name,
                "category": category,
                "unit": unit,
                "pack": 1,
                "standard": product_id.startswith("G-"),
                "critical": category in {"Füllung", "Endodontie", "Prothetik", "Implantologie"},
                "approved": score >= 0.9,
            })
            if products_by_id[product_id]["unit"] != unit:
                products_by_id[product_id]["unit"] = "Basiseinheit"
            normalized_qty = item["quantity"] * pack_factor
            normalized_unit_price = item["unit_price"] / pack_factor if pack_factor else item["unit_price"]
            item_rows.append({
                "invoice_id": inv_id,
                "product_id": product_id,
                "qty": normalized_qty,
                "list_price": normalized_unit_price,
                "item_discount": item_discount(item),
                "supplier_item_name": f'{summary["supplier"]} ArtNr {item["article_no"]}: {item["description"]} · Basis: {pack_note}',
                "match_score": score,
            })
            if item["unit_price"]:
                supplier_price_values[(summary["supplier"], product_id)].append(abs(normalized_unit_price))

    supplier_price_rows = [
        {"supplier_name": supplier, "product_id": product_id, "price": round(mean(values), 4)}
        for (supplier, product_id), values in sorted(supplier_price_values.items())
    ]

    sample_updates = [{
        "file": summary["file"],
        "sample_items": summary["items"][:8],
        "extracted_items": summary["extracted_items"],
    } for summary in summaries]

    return {
        "summaries": summaries,
        "products": sorted(products_by_id.values(), key=lambda row: row["id"]),
        "invoices": invoice_rows,
        "invoice_items": item_rows,
        "supplier_prices": supplier_price_rows,
        "sample_updates": sample_updates,
    }


def request_json(method: str, path: str, payload=None) -> object:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            text = response.read().decode("utf-8")
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {error.code} {details}") from error


def chunked(rows: list[dict], size: int = 100) -> list[list[dict]]:
    return [rows[index:index + size] for index in range(0, len(rows), size)]


def seed_supabase(payload: dict) -> None:
    delete_filters = {
        "invoice_items": "invoice_id=not.is.null",
        "supplier_prices": "supplier_name=not.is.null",
        "products": "id=not.is.null",
        "invoices": "id=not.is.null",
    }
    for table, delete_filter in delete_filters.items():
        request_json("DELETE", f"{table}?{delete_filter}")

    for table in ["products", "invoices", "supplier_prices", "invoice_items"]:
        rows = payload[table]
        for batch in chunked(rows):
            request_json("POST", table, batch)

    for update in payload["sample_updates"]:
        file_filter = urllib.parse.quote(update["file"], safe="")
        try:
            request_json("PATCH", f"sample_imports?file=eq.{file_filter}", {
                "sample_items": update["sample_items"],
                "extracted_items": update["extracted_items"],
            })
        except RuntimeError as error:
            seed_warnings.append(str(error))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=extractor.DEFAULT_INPUT_DIR)
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "matched-invoice-analysis.json")
    parser.add_argument("--seed", action="store_true")
    args = parser.parse_args()

    payload = build_payload(args.input_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.seed:
        seed_supabase(payload)
    print(json.dumps({
        "pdfs": len(payload["summaries"]),
        "products": len(payload["products"]),
        "invoices": len(payload["invoices"]),
        "invoice_items": len(payload["invoice_items"]),
        "supplier_prices": len(payload["supplier_prices"]),
        "seeded": args.seed,
        "warnings": len(seed_warnings),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
