# DiHandyApp

Mobile Companion-App zum **DiffadDashboard 2.0** – eine einseitige PWA mit
72-Stunden-Wettergraph und animiertem Regenradar im gleichen dunklen Design.

## Features

- **Aktuelles Wetter** kompakt: Temperatur, Wettersymbol, gefühlte Temperatur,
  Wind, Luftfeuchte, Sonnenauf-/untergang
- **Wettergraph (72 h)** mit 4 Teilgraphen wie auf dem Pi-Dashboard:
  Temperatur (gelb), Sonnenstrahlung (orange), Niederschlag + Wahrscheinlichkeit
  (blau), Wind + Böen (grün/orange) – inkl. Tag/Nacht-Streifen und
  Sonnenzeiten auf der X-Achse
- **Luftqualität**: EU AQI, PM2.5, PM10, UV-Index mit Status-Punkten
- **Regenradar** (RainViewer + Leaflet, CartoDB Dark) mit Animation der
  letzten Aufnahmen und Kurzfrist-Vorhersage
- **GPS-Standort** mit Fallback auf Westbevern (51.982°N, 7.776°O),
  Ortsname via Nominatim
- **PWA**: auf dem Homescreen installierbar, App-Shell offline-fähig

## Datenquellen (alle kostenlos, ohne API-Key)

| Quelle | Zweck |
|---|---|
| [Open-Meteo Forecast](https://open-meteo.com) | Wetterdaten (current/hourly/daily) |
| [Open-Meteo Air Quality](https://open-meteo.com) | PM2.5, PM10, EU AQI, UV |
| [RainViewer](https://www.rainviewer.com) | Regenradar-Tiles |
| [Nominatim/OSM](https://nominatim.org) | Reverse-Geocoding des Ortsnamens |

## Nutzung

### Online (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` veröffentlicht die App automatisch
bei jedem Push. **Einmalig aktivieren:** Repository → *Settings* → *Pages* →
*Build and deployment* → Source: **GitHub Actions**.

Danach ist die App unter `https://<user>.github.io/DiHandyapp/` erreichbar.
Auf dem Handy öffnen → Browser-Menü → **„Zum Startbildschirm hinzufügen“**.

> GPS funktioniert nur über HTTPS – GitHub Pages erfüllt das automatisch.

### Lokal testen

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Dateien

```
index.html            App-Gerüst (eine Seite)
style.css             Design-System (Farben/Fonts wie DiffadDashboard)
app.js                Logik: GPS, APIs, Canvas-Graphen, Radar
sw.js                 Service Worker (App-Shell-Cache)
manifest.webmanifest  PWA-Manifest
icons/                App-Icons
docs/DASHBOARD.md     Doku des zugrunde liegenden Pi-Dashboards
```

## Versionsschema

`1.0.XXX` – dreistellige Unterversion, wird bei jeder Änderung hochgezählt
(in `app.js` → `APP_VERSION` und `sw.js` → `CACHE`).
