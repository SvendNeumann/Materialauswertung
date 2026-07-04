# Importnotizen Beispielrechnungen

## Erkannte Lieferantenprofile

### Henry Schein

- Dateien: `Rechnung_*.PDF`
- Rechnungsnummer: `Rechnung 231...`
- Datum: `Datum: TT.MM.JJJJ`
- Kundennummer: `Kundennummer: ...`
- Positionen: Artikelnummer, Menge, Bezeichnung, Konditionscodes, Einzelpreis, Gesamtpreis
- Summen: `Summe Positionen`, optional `Versandkosten`, `Mehrwertsteuer`, `Endbetrag`
- Besonderheit: mehrere Lieferscheine pro Rechnung, Seitenüberträge, Konditionscodes in der Positionszeile

### GERL

- Dateien: `312075-Ihre_GERL-Rechnung_*.pdf`
- Dokumenttyp: Monatsrechnung
- Rechnungsnummer: `Nummer ...`
- Datum: `Datum TT.MM.JJJJ`
- Kundennummer: `Kundennummer 312075`
- Positionen: Artnr, Artikelbezeichnung, Menge, Preis EUR, Gesamtwert
- Summen: `Ne-Warenwert / MwSt / Re-Betrag EUR`
- Besonderheit: negative Mengen/Gutschriften innerhalb einer Monatsrechnung

### Plandent

- Dateien: `SalesInvoice__*.PDF`
- Dokumenttyp: Rechnung oder Gutschrift
- Rechnungsnummer: `Rechnungs-Nr.` oder `Gutschrifts-Nr.`
- Datum: `Datum: TT.MM.JJJJ`
- Kundennummer: `Kunden-Nr.`
- Positionen: Pos, Art-Nr., Bezeichnung, Menge, Preis, Ihr Preis, Summe
- Summen: `Zwischensumme`, optional `Mindermenge Inland`, `MwSt`, `Gesamtsumme`
- Besonderheit: explizite Rabattzeilen je Position, nicht rabattfähige Artikel mit `*`, Sonderbeschaffung mit `SB`

## Standortableitung aus Anschrift

- Kehl: `Rheinstr. 46`, `77694 Kehl`
- Kirchberg: `Auerbacher Str. 13`, `08107 Kirchberg`
- Essen Zollverein: `Viktoriastraße 41a`, `45327 Essen`, `Zeche Zollverein`
- Hüttenberg: `Langgönser Str. 29`, `35625 Hüttenberg`

## Aktueller Extraktionsstand

- 12 von 12 Beispiel-PDFs werden einem Lieferantenprofil zugeordnet.
- 12 von 12 Beispiel-PDFs werden einem Standort zugeordnet.
- 12 von 12 Beispiel-PDFs liefern Rechnungsnummer, Datum, Kundennummer, Bruttosumme und Positionsanzahl.
- Die Positionslogik ist heuristisch vorbereitet und muss bei neuen Lieferantenlayouts erweitert werden.
