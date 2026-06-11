# DiffadDashboard – Projektdokumentation

## Projektübersicht

**Name:** DiffadDashboard 2.0  
**Typ:** Lokales Infoscreen-Dashboard auf Raspberry Pi 3 Model B  
**Standort:** Westbevern / Telgte, Kreis Warendorf, NRW, Deutschland  
**Koordinaten:** 51.982°N, 7.776°O  
**Betriebssystem:** Raspberry Pi OS (Debian Bookworm, Wayland)  
**User:** diffad  
**Hostname:** diffadpidisplay  

---

## Design-System

### Farbpalette
```
--bg:     #080b10   → Hintergrund (sehr dunkel)
--surf:   #0e1219   → Panel-Oberfläche
--border: #2e3850   → Rahmen/Trennlinien
--accent: #39e8b0   → Primäre Akzentfarbe (Türkis/Grün)
--yellow: #f5c842   → Sekundäre Akzentfarbe (Gelb/Gold)
--blue:   #5a9fff   → Regen/Info (Blau)
--red:    #ff5555   → Fehler/Warnung (Rot)
--orange: #ff8c42   → Böen/Warnung (Orange)
--text:   #f0f4ff   → Haupttext (Fast-Weiß)
--muted:  #99aabb   → Gedämpfter Text
--mid:    #c8d8e8   → Mittlerer Text
```

### Typografie
- **Display/Headlines:** `Barlow Condensed` (700/800 weight) – Google Fonts
- **Monospace/Daten:** `Share Tech Mono` – Google Fonts
- **Emoji:** `Segoe UI Emoji`, `Apple Color Emoji`, `Noto Color Emoji`

### Design-Prinzipien
- Dunkles Theme, minimalistisch
- Daten stehen im Vordergrund, keine Ablenkung
- Farbige Punkte/Dots als Status-Indikatoren
- Barlow Condensed für alle Werte und Kennzahlen
- Share Tech Mono für Rohdaten und Beschriftungen
- Abgerundete Ecken (5px) für Panels
- Panels mit 1px Border in --border Farbe

---

## Display

**Auflösung:** 800×480 Pixel  
**Ausrichtung:** 180° gedreht (Hardware-spezifisch)  
**Typ:** DSI Touchscreen (ft5x06, als Mausersatz deaktiviert)  

---

## Layout (aktuell)

```
┌─────────────────────────────────────────────────────┐
│  Topbar (50px): Uhrzeit | Sonne | Status | Brand    │
├────────────┬───────────────────────────┬────────────┤
│  Bahn      │   Wettergraph (4 Graphen) │ Wetterkar- │
│  (130px)   │   Temp/Sonne/Regen/Wind   │ te (270px) │
│  5 Züge    │   + Luftqualität          │ NRW Radar  │
│  vertikal  │                           │            │
└────────────┴───────────────────────────┴────────────┘
```

---

## Datenquellen & APIs

### Wetter – Open-Meteo (kostenlos, kein API-Key)
```
https://api.open-meteo.com/v1/forecast
Parameter: latitude=51.982, longitude=7.776
Current: temperature_2m, relative_humidity_2m, apparent_temperature,
         wind_speed_10m, wind_direction_10m, weather_code, precipitation
Hourly:  temperature_2m, precipitation_probability, weather_code,
         wind_speed_10m, wind_gusts_10m, precipitation, direct_radiation
Daily:   sunrise, sunset, weather_code, temperature_2m_max/min,
         precipitation_sum
Timezone: Europe/Berlin
forecast_days: 6
wind_speed_unit: kmh
```

### Luftqualität – Open-Meteo Air Quality (kostenlos)
```
https://air-quality-api.open-meteo.com/v1/air-quality
Parameter: latitude=51.982, longitude=7.776
Current: pm2_5, pm10, european_aqi, uv_index
```
**WHO-Grenzwerte:** PM2.5 ≤ 15 µg/m³, PM10 ≤ 45 µg/m³  
**EU AQI Skala:** 0-20 sehr gut, 21-40 gut, 41-60 mäßig, 61-80 schlecht, 81+ sehr schlecht

### Regenradar – Rainviewer (kostenlos)
```
https://api.rainviewer.com/public/weather-maps.json
Tiles: https://tilecache.rainviewer.com{path}/512/{z}/{x}/{y}/6/1_1.png
```
Leaflet.js Karte, Zoom 7 (NRW-Übersicht), Kartenthema: CartoDB Dark

### Bahn – DBF (kostenlos, CORS-freundlich)
```
Primär:   https://dbf.finalrewind.org/Westbevern.json?version=3&limit=20
Fallback: https://bahn.expert/api/iris/v2/abfahrten/8006361?lookahead=180
```
**Bahnhof:** Westbevern  
**EVA-Nummer:** 8006361  
**Filter:** Nur Richtung Münster (Gleis 2 oder Ziel Münster/Dortmund/Hamm/Düsseldorf/Köln)  
**Anzeige:** 5 nächste Züge mit Linie, Ziel, Verspätung, Gleis

### WMO Wettercodes → Emoji + Text
```javascript
0: ☀️ Klar        1: 🌤 Meist klar   2: ⛅ Bewölkt
3: ☁️ Bedeckt     45/48: 🌫 Nebel    51/53: 🌦 Niesel
61/63: 🌧 Regen   65: 🌧 Starkregen  71-75: ❄️ Schnee
80-82: 🌦 Schauer 95-99: ⛈ Gewitter
```

---

## Wettergraph – 4 Teilgraphen

**Zeitraum:** 72 Stunden (3 Tage) ab aktueller Stunde  
**Aufbau:** 4 übereinander angeordnete Canvas-Graphen

| Graph | Daten | Farbe |
|-------|-------|-------|
| Temperatur (2× hoch) | °C, Tageshöchst/Tiefstwerte | #f5c842 Gelb |
| Sonnenstrahlung | W/m² (direct_radiation) | rgba(255,165,0) Orange |
| Niederschlag | mm + Wahrscheinlichkeit % | rgba(50,130,255) Blau |
| Wind | km/h Ø + Böen gestrichelt | rgba(57,232,176) Grün |

**X-Achse (von oben nach unten):**
1. Tag/Nacht-Streifen mit Auf-/Untergangsmarkierungen
2. Zeitangaben der Auf-/Untergangszeiten (HH:MM)
3. Stundenticks (00/06/12/18 Uhr)
4. Wochentag + Datum

---

## Topbar

```
[Uhrzeit HH:MM:SS] [Sonnenaufg./Sonnenunterg. HH:MM] | [Wetter ✓] | [Bahn ✓] | [Karte ✓] | DiffadDashboard Version 2.0.XXX
```

**Versionsschema:** 2.0.XXX (dreistellige Unterversion, wird bei jeder Änderung hochgezählt)  
**Aktuelle Version:** 2.0.041

---

## Systemkonfiguration

### Raspberry Pi Setup
```
OS:         Raspberry Pi OS Bookworm (Wayland)
Compositor: labwc (Wayland, Kiosk-Modus)
Browser:    Chromium (Kiosk-Modus)
User:       diffad
```

### Boot-Ablauf
```
Power → Kernel → CLI Autologin (diffad) → ~/.profile → start-kiosk.sh → labwc → start-chromium.sh → wlr-randr (180°) → Chromium
```

### Wichtige Dateien
```
~/dashboard/DiffadDashboard2.0.html   → Haupt-Dashboard
~/dashboard/start-kiosk.sh           → labwc starten
~/dashboard/start-chromium.sh        → Rotation + Chromium
~/.config/labwc/rc.xml               → labwc Konfiguration
~/.config/labwc/environment          → Umgebungsvariablen
~/.config/labwc/autostart            → Autostart-Befehle
/boot/firmware/config.txt            → Pi Hardware-Konfiguration
/usr/share/plymouth/themes/diffad/   → Boot-Splash
/usr/share/icons/empty/cursors/      → Transparentes Cursor-Theme
```

### Wichtige Konfigurationen
```bash
# /boot/firmware/config.txt
display_rotate=2          # Bildschirm 180° gedreht (wird via wlr-randr gemacht)
dtoverlay=vc4-kms-v3d     # GPU-Treiber

# labwc environment
XCURSOR_THEME=empty       # Transparenter Cursor
WLR_NO_HARDWARE_CURSORS=1 # Kein Hardware-Cursor
```

---

## Geplante Features (noch nicht umgesetzt)

- **Zeitgesteuerte Bildschirmabschaltung** via `wlr-randr --off/--on` + cron
- **Bewegungsmelder-Integration** via GPIO (PIR-Sensor an Pin 17)
- **DWD Wetterwarnungen** (API bereits vorbereitet, Warncell Kreis Warendorf)
- **Pegelstand Ems/Werse** via Pegelonline API

---

## App-Idee (nächstes Projekt)

Mobile Companion-App zum DiffadDashboard mit denselben Daten:
- Gleiche APIs (Open-Meteo, DBF, Rainviewer)
- Gleiche Farbpalette und Design-Sprache
- Standort: Westbevern/Telgte
- Plattform: noch offen (React Native / Flutter / PWA)

---

## Kontakt / Projekt-Infos

**Projektname intern:** DiffadDashboard  
**Standort:** Westbevern, Kreis Warendorf, NRW, 52°N 7°O  
**Zeitzone:** Europe/Berlin (UTC+1/+2)  
**Sprache:** Deutsch  
