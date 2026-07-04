# Materialauswertung

Klickbarer MVP-Prototyp fuer Materialpreis-Controlling, Rechnungsanalyse und Einkaufsempfehlungen fuer den Orisus-Praxisverbund.

## Umfang

- Management-Dashboard mit KPI-Karten, Warnungen und Ranking-Charts
- Rechnungsupload-Simulation mit Statusworkflow und Dublettenhinweis
- KI-/OCR-Pruefcenter mit PDF-Vorschau, Rechnungsdaten und Positionskorrektur
- Artikelstamm mit Gruppenartikeln, Lieferantenartikeln und Matching-Sicherheit
- Effektive Preisberechnung inklusive Positionsrabatt, Rechnungsrabatt, Skonto, Versand und Zuschlaegen
- Artikelpreisvergleich, Standortanalyse, Lieferantenbewertung und Warenkorbsimulation
- Priorisierte A/B/C-Empfehlungen mit Standortleiter-Ansicht
- Report-Center mit PDF-Druckansicht und CSV/Excel-Export
- Beispielimport echter PDF-Rechnungen mit Lieferantenprofilen fuer Henry Schein, GERL und Plandent

## Beispielrechnungen extrahieren

```bash
python3 scripts/extract-sample-invoices.py
```

Das Skript erzeugt `data/sample-invoice-imports.json`. Fuer die Demo-Oberflaeche liegt eine Kopie unter `public/sample-invoice-imports.json`.

## Lokal starten

```bash
python3 -m http.server 4173 -d public
```

Danach im Browser `http://127.0.0.1:4173` oeffnen.
