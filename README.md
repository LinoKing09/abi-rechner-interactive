# abi-rechner-interactive
Aktuellen Abi Schnitt ausrechnen leicht gemacht!

Ein Abiturschnitt-Rechner für die gymnasiale Oberstufe in Baden-Württemberg.
Reine statische Webseite (HTML/CSS/JavaScript), kein Server und kein Build-Schritt nötig.

## Funktionen

- Notenpunkte (0–15) für alle Kurse aus J1.1 bis J2.2 eintragen, Leistungsfächer markieren
- Block I (max. 600), Block II (max. 300) und Durchschnittsnote nach der KMK-Formel
- Hochrechnung, solange noch nicht alle Noten feststehen
- Kurse automatisch (LF + Prüfungsfächer + beste übrige Kurse) oder manuell einbringen
- Hinweise zu Zulassungs- und Bestehensregeln (Mindestpunkte, Unterkurse)
- Export als JSON (wieder importierbar) und als CSV für Excel
- Lokale Benutzerkonten mit „Angemeldet bleiben“: Die Noten werden automatisch gespeichert

## Starten

```sh
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Die Seite funktioniert auch auf GitHub Pages. Für die Anmeldung wird eine sichere Umgebung
(`https://` oder `localhost`) benötigt, da Passwörter mit der Web Crypto API gehasht werden.

## Datenspeicherung

Es gibt kein Backend: Konten und Noten liegen im `localStorage` des jeweiligen Browsers.
Ohne Anmeldung bleiben die Eingaben nur bis zum Schließen des Tabs erhalten.
Um Noten auf ein anderes Gerät zu übertragen, die Export-/Import-Funktion nutzen.

## Tests

```sh
node --test test/*.test.js
```

Inoffizielles Projekt, kein Angebot des Ministeriums für Kultus, Jugend und Sport Baden-Württemberg.
Alle Angaben ohne Gewähr.
