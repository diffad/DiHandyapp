/* ============================================================
   DiHandyApp – Mobile Companion zum DiffadDashboard 2.0
   Wettergraph (72h) + Regenradar, Design wie das Pi-Dashboard
   ============================================================ */
'use strict';

const APP_VERSION = '1.0.009';

// Fallback-Standort: Westbevern / Telgte
const FALLBACK = { lat: 51.982, lon: 7.776, name: 'Westbevern' };

const HOURS = 72;            // Zeitraum des Graphen
const REFRESH_WEATHER = 10 * 60 * 1000;
const REFRESH_RADAR   =  5 * 60 * 1000;

// CSS-Farbpalette
const C = {
  bg: '#080b10', surf: '#0e1219', border: '#2e3850',
  accent: '#39e8b0', yellow: '#f5c842', blue: '#5a9fff',
  red: '#ff5555', orange: '#ff8c42',
  text: '#f0f4ff', muted: '#99aabb', mid: '#c8d8e8',
};

// WMO Wettercode → Emoji + Text
const WMO = {
  0: ['☀️', 'Klar'], 1: ['🌤', 'Meist klar'], 2: ['⛅', 'Bewölkt'], 3: ['☁️', 'Bedeckt'],
  45: ['🌫', 'Nebel'], 48: ['🌫', 'Nebel'],
  51: ['🌦', 'Niesel'], 53: ['🌦', 'Niesel'], 55: ['🌦', 'Niesel'],
  56: ['🌧', 'Eisniesel'], 57: ['🌧', 'Eisniesel'],
  61: ['🌧', 'Regen'], 63: ['🌧', 'Regen'], 65: ['🌧', 'Starkregen'],
  66: ['🌧', 'Eisregen'], 67: ['🌧', 'Eisregen'],
  71: ['❄️', 'Schnee'], 73: ['❄️', 'Schnee'], 75: ['❄️', 'Schnee'], 77: ['❄️', 'Schnee'],
  80: ['🌦', 'Schauer'], 81: ['🌦', 'Schauer'], 82: ['🌦', 'Schauer'],
  85: ['❄️', 'Schneeschauer'], 86: ['❄️', 'Schneeschauer'],
  95: ['⛈', 'Gewitter'], 96: ['⛈', 'Gewitter'], 99: ['⛈', 'Gewitter'],
};
const wmo = (code) => WMO[code] || ['❓', '–'];

const $ = (id) => document.getElementById(id);
const setDot = (id, cls) => { $(id).className = 'dot ' + cls; };

let loc = { ...FALLBACK, gps: false };
let weatherData = null;

/* ── Standort ─────────────────────────────────────────────── */

function getPosition() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&accept-language=de`
    );
    const j = await r.json();
    const a = j.address || {};
    return a.village || a.suburb || a.town || a.city || a.municipality || a.county || j.name || null;
  } catch { return null; }
}

async function initLocation() {
  const pos = await getPosition();
  if (pos) {
    loc = { ...pos, name: null, gps: true };
    $('locName').textContent = `${pos.lat.toFixed(3)}°N ${pos.lon.toFixed(3)}°O`;
    reverseGeocode(pos.lat, pos.lon).then((name) => {
      if (name) { loc.name = name; $('locName').textContent = name; }
    });
  } else {
    loc = { ...FALLBACK, gps: false };
    $('locName').textContent = `${FALLBACK.name} (Standard)`;
  }
}

/* ── Datenabruf ───────────────────────────────────────────── */

async function fetchWeather() {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,precipitation',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,direct_radiation',
    daily: 'sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto', forecast_days: 6, wind_speed_unit: 'kmh',
  });
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function fetchAir() {
  const u = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  u.search = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon,
    current: 'pm2_5,pm10,european_aqi,uv_index',
    timezone: 'auto',
  });
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ── Aktuelles Wetter ─────────────────────────────────────── */

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];
const hhmm = (iso) => iso.slice(11, 16);

function renderCurrent(d) {
  const c = d.current;
  const [emoji, desc] = wmo(c.weather_code);
  $('curTemp').textContent = Math.round(c.temperature_2m) + '°';
  $('curEmoji').textContent = emoji;
  $('curDesc').textContent = desc;
  $('curFeels').textContent = Math.round(c.apparent_temperature) + '°';
  $('curWind').textContent = `${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)}`;
  $('curHum').textContent = Math.round(c.relative_humidity_2m) + '%';
  $('curSunrise').textContent = hhmm(d.daily.sunrise[0]);
  $('curSunset').textContent = hhmm(d.daily.sunset[0]);
}

/* ── Luftqualität ─────────────────────────────────────────── */

// Wert anhand von Schwellen einordnen → [Punktfarbe, Bewertungstext]
function rate(value, thresholds, labels) {
  const CLASSES = ['ok', 'warn', 'bad', 'err', 'err'];
  let i = thresholds.findIndex((t) => value <= t);
  if (i < 0) i = thresholds.length;
  return [CLASSES[i], labels[i]];
}

function airRow(prefix, value, text, thresholds, labels) {
  const [cls, label] = rate(value, thresholds, labels);
  $(prefix + 'Val').textContent = text;
  $(prefix + 'Rate').textContent = label;
  setDot(prefix + 'Dot', cls);
}

function renderAir(d) {
  const c = d.current;
  airRow('aqi', c.european_aqi, Math.round(c.european_aqi),
    [20, 40, 60, 80], ['sehr gut', 'gut', 'mäßig', 'schlecht', 'sehr schlecht']);
  airRow('pm25', c.pm2_5, c.pm2_5.toFixed(0),
    [15, 30, 50], ['gut', 'erhöht', 'hoch', 'sehr hoch']);          // WHO: ≤15 µg/m³
  airRow('pm10', c.pm10, c.pm10.toFixed(0),
    [45, 90, 150], ['gut', 'erhöht', 'hoch', 'sehr hoch']);         // WHO: ≤45 µg/m³
  airRow('uv', c.uv_index, c.uv_index.toFixed(1),
    [2.9, 5.9, 7.9], ['niedrig', 'mittel', 'hoch', 'sehr hoch']);
}

/* ── Wettergraph: 4 Teilgraphen + Achse ───────────────────── */

const PAD_L = 8, PAD_R = 8;
const WEEKDAYS = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];

function setupCanvas(canvas, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth;
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: cssHeight };
}

// Stundenslice ab aktueller Stunde aufbereiten
function buildSlice(d) {
  const h = d.hourly;
  const nowKey = d.current.time.slice(0, 13);          // "YYYY-MM-DDTHH"
  let start = h.time.findIndex((t) => t.slice(0, 13) === nowKey);
  if (start < 0) start = 0;
  const end = Math.min(start + HOURS, h.time.length);

  const idx = [];
  for (let i = start; i < end; i++) idx.push(i);

  // Sonnenauf-/untergänge als fraktionale Position im Slice
  const sun = [];
  for (let di = 0; di < d.daily.time.length; di++) {
    for (const key of ['sunrise', 'sunset']) {
      const iso = d.daily[key][di];
      const dayStart = h.time.indexOf(iso.slice(0, 10) + 'T00:00');
      if (dayStart < 0) continue;
      const f = dayStart + parseInt(iso.slice(11, 13), 10) + parseInt(iso.slice(14, 16), 10) / 60 - start;
      if (f >= 0 && f <= HOURS) sun.push({ f, type: key, label: hhmm(iso) });
    }
  }

  return {
    time: idx.map((i) => h.time[i]),
    temp: idx.map((i) => h.temperature_2m[i]),
    rad: idx.map((i) => h.direct_radiation[i]),
    precip: idx.map((i) => h.precipitation[i]),
    prob: idx.map((i) => h.precipitation_probability[i]),
    wind: idx.map((i) => h.wind_speed_10m[i]),
    gust: idx.map((i) => h.wind_gusts_10m[i]),
    dir: idx.map((i) => h.wind_direction_10m[i]),
    sun,
  };
}

function xPos(f, w) { return PAD_L + (f / (HOURS - 1)) * (w - PAD_L - PAD_R); }

// Tag/Nacht-Hintergrund + 6h-Gitter, gemeinsam für alle Teilgraphen
function drawBackdrop(ctx, w, h, s) {
  // Tagphasen leicht aufhellen
  let rise = null;
  for (const ev of s.sun) {
    if (ev.type === 'sunrise') rise = ev.f;
    else {
      const x0 = xPos(Math.max(rise ?? 0, 0), w);
      ctx.fillStyle = 'rgba(245,200,66,0.045)';
      ctx.fillRect(x0, 0, xPos(ev.f, w) - x0, h);
      rise = null;
    }
  }
  if (rise !== null) {
    const x0 = xPos(rise, w);
    ctx.fillStyle = 'rgba(245,200,66,0.045)';
    ctx.fillRect(x0, 0, xPos(HOURS - 1, w) - x0, h);
  }
  // Gitterlinien alle 6 h, Mitternacht kräftiger
  for (let i = 0; i < s.time.length; i++) {
    const hr = +s.time[i].slice(11, 13);
    if (hr % 6 !== 0) continue;
    ctx.strokeStyle = hr === 0 ? 'rgba(46,56,80,0.9)' : 'rgba(46,56,80,0.4)';
    ctx.beginPath();
    const x = xPos(i, w) + 0.5;
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.stroke();
  }
}

function graphLabel(ctx, text, color) {
  ctx.font = '10px "Share Tech Mono", monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(text, PAD_L + 2, 3);
}

function drawLine(ctx, w, h, data, min, max, color, { dash = null, fill = null, top = 14, bottom = 4 } = {}) {
  const y = (v) => h - bottom - ((v - min) / (max - min || 1)) * (h - top - bottom);
  ctx.beginPath();
  data.forEach((v, i) => {
    const px = xPos(i, w), py = y(v);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  if (fill) {
    ctx.save();
    ctx.lineTo(xPos(data.length - 1, w), h - bottom);
    ctx.lineTo(xPos(0, w), h - bottom);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    data.forEach((v, i) => {
      const px = xPos(i, w), py = y(v);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
  return y;
}

function drawTempGraph(s) {
  const { ctx, w, h } = setupCanvas($('gTemp'), 120);
  drawBackdrop(ctx, w, h, s);
  const min = Math.min(...s.temp), max = Math.max(...s.temp);
  const pad = Math.max(1, (max - min) * 0.12);
  const y = drawLine(ctx, w, h, s.temp, min - pad, max + pad, C.yellow,
    { fill: 'rgba(245,200,66,0.10)', top: 18, bottom: 14 });

  // Tageshöchst-/Tiefstwerte beschriften
  ctx.font = '700 12px "Barlow Condensed", sans-serif';
  const days = {};
  s.time.forEach((t, i) => {
    const day = t.slice(0, 10);
    (days[day] = days[day] || []).push(i);
  });
  for (const idx of Object.values(days)) {
    if (idx.length < 5) continue;
    let hi = idx[0], lo = idx[0];
    for (const i of idx) {
      if (s.temp[i] > s.temp[hi]) hi = i;
      if (s.temp[i] < s.temp[lo]) lo = i;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = C.yellow;
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(s.temp[hi]) + '°', Math.min(Math.max(xPos(hi, w), 12), w - 12), y(s.temp[hi]) - 2);
    ctx.fillStyle = C.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(Math.round(s.temp[lo]) + '°', Math.min(Math.max(xPos(lo, w), 12), w - 12), y(s.temp[lo]) + 2);
  }
  graphLabel(ctx, 'TEMPERATUR °C', C.yellow);
}

function drawSunGraph(s) {
  const { ctx, w, h } = setupCanvas($('gSun'), 56);
  drawBackdrop(ctx, w, h, s);
  const top = 14, bottom = 4;
  const max = Math.max(400, ...s.rad);
  const bw = Math.max(1.5, (w - PAD_L - PAD_R) / HOURS * 0.7);
  ctx.fillStyle = 'rgba(255,165,0,0.75)';
  s.rad.forEach((v, i) => {
    if (v <= 0) return;
    const bh = (v / max) * (h - top - bottom);
    ctx.fillRect(xPos(i, w) - bw / 2, h - bottom - bh, bw, bh);
  });
  graphLabel(ctx, `SONNE W/m² (max ${Math.round(Math.max(...s.rad))})`, 'rgba(255,165,0,0.9)');
}

function drawRainGraph(s) {
  const { ctx, w, h } = setupCanvas($('gRain'), 56);
  drawBackdrop(ctx, w, h, s);
  const top = 14, bottom = 4;
  const maxP = Math.max(1.5, ...s.precip);
  // Niederschlagsbalken (mm)
  const bw = Math.max(1.5, (w - PAD_L - PAD_R) / HOURS * 0.7);
  ctx.fillStyle = 'rgba(50,130,255,0.75)';
  s.precip.forEach((v, i) => {
    if (v <= 0) return;
    const bh = (v / maxP) * (h - top - bottom);
    ctx.fillRect(xPos(i, w) - bw / 2, h - bottom - bh, bw, bh);
  });
  // Wahrscheinlichkeit (%) als dünne Linie
  drawLine(ctx, w, h, s.prob, 0, 100, 'rgba(90,159,255,0.55)', { dash: [3, 3] });
  graphLabel(ctx, `REGEN mm·% (max ${Math.max(...s.precip).toFixed(1)})`, C.blue);
}

function drawWindGraph(s) {
  const { ctx, w, h } = setupCanvas($('gWind'), 70);
  drawBackdrop(ctx, w, h, s);
  const max = Math.max(30, ...s.gust) * 1.1;
  drawLine(ctx, w, h, s.gust, 0, max, 'rgba(255,140,66,0.8)', { dash: [4, 3], top: 28 });
  drawLine(ctx, w, h, s.wind, 0, max, 'rgba(57,232,176,0.9)', { fill: 'rgba(57,232,176,0.08)', top: 28 });

  // Windrichtungs-Pfeile (Pfeil zeigt, wohin der Wind weht)
  ctx.strokeStyle = C.mid;
  ctx.fillStyle = C.mid;
  ctx.lineWidth = 1.2;
  for (let i = 3; i < s.dir.length; i += 6) {
    const a = (s.dir[i] + 180) * Math.PI / 180;
    ctx.save();
    ctx.translate(xPos(i, w), 20);
    ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 4.5); ctx.lineTo(0, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.lineTo(-3, -1); ctx.lineTo(3, -1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  graphLabel(ctx, `WIND km/h · BÖEN (max ${Math.round(Math.max(...s.gust))})`, C.accent);
}

function drawAxis(s) {
  const { ctx, w, h } = setupCanvas($('gAxis'), 64);

  // 1) Tag/Nacht-Streifen
  ctx.fillStyle = 'rgba(20,26,40,1)';
  ctx.fillRect(PAD_L, 2, w - PAD_L - PAD_R, 8);
  let rise = null;
  const dayStripe = (f0, f1) => {
    ctx.fillStyle = 'rgba(245,200,66,0.55)';
    ctx.fillRect(xPos(f0, w), 2, xPos(f1, w) - xPos(f0, w), 8);
  };
  for (const ev of s.sun) {
    if (ev.type === 'sunrise') rise = ev.f;
    else { dayStripe(Math.max(rise ?? 0, 0), ev.f); rise = null; }
  }
  if (rise !== null) dayStripe(rise, HOURS - 1);

  // 2) Auf-/Untergangszeiten
  ctx.font = '9px "Share Tech Mono", monospace';
  ctx.textBaseline = 'top';
  for (const ev of s.sun) {
    const x = Math.min(Math.max(xPos(ev.f, w), 16), w - 16);
    ctx.fillStyle = ev.type === 'sunrise' ? C.yellow : C.orange;
    ctx.textAlign = 'center';
    ctx.fillText(ev.label, x, 13);
  }

  // 3) Stundenticks 00/06/12/18 + 4) Wochentag/Datum
  ctx.textAlign = 'center';
  const dayCols = {};
  s.time.forEach((t, i) => {
    const day = t.slice(0, 10);
    (dayCols[day] = dayCols[day] || []).push(i);
    const hr = +t.slice(11, 13);
    if (hr % 6 === 0) {
      ctx.fillStyle = hr === 0 ? C.mid : C.muted;
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.fillText(String(hr).padStart(2, '0'), xPos(i, w), 28);
    }
  });
  for (const [day, idx] of Object.entries(dayCols)) {
    // Label nur, wenn der (ggf. angebrochene) Tag breit genug dafür ist
    if (xPos(idx[idx.length - 1], w) - xPos(idx[0], w) < 70) continue;
    const mid = Math.min(Math.max(xPos((idx[0] + idx[idx.length - 1]) / 2, w), 36), w - 36);
    const dt = new Date(day + 'T12:00:00');
    ctx.fillStyle = C.mid;
    ctx.font = '700 13px "Barlow Condensed", sans-serif';
    ctx.fillText(`${WEEKDAYS[dt.getDay()]} ${day.slice(8, 10)}.${day.slice(5, 7)}.`, mid, 44);
  }
}

// Detailgraph: nächste 24 h kombiniert – Temperaturlinie, Sonnen- und
// Regenbalken in einem Bild, X-Achse mit Stundenbeschriftung
function drawDayGraph(s) {
  const N = 24;
  const { ctx, w, h } = setupCanvas($('gDay'), 170);
  const x = (f) => PAD_L + (f / (N - 1)) * (w - PAD_L - PAD_R);
  const axisH = 16, top = 16;
  const pb = h - axisH;                    // Unterkante Plotbereich

  // Tagphasen aufhellen (auf 0..N begrenzt)
  ctx.fillStyle = 'rgba(245,200,66,0.05)';
  let rise = null;
  const stripe = (a, b) => {
    a = Math.max(a, 0); b = Math.min(b, N - 1);
    if (b > a) ctx.fillRect(x(a), 0, x(b) - x(a), pb);
  };
  for (const ev of s.sun) {
    if (ev.type === 'sunrise') rise = ev.f;
    else { stripe(rise ?? 0, ev.f); rise = null; }
  }
  if (rise !== null) stripe(rise, N - 1);

  // Stundengitter + Beschriftung alle 2 h
  ctx.font = '9px "Share Tech Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i < N; i++) {
    const hr = +s.time[i].slice(11, 13);
    ctx.strokeStyle = hr % 6 === 0 ? 'rgba(46,56,80,0.9)' : 'rgba(46,56,80,0.3)';
    ctx.beginPath();
    const px = x(i) + 0.5;
    ctx.moveTo(px, 0); ctx.lineTo(px, pb);
    ctx.stroke();
    if (hr % 2 === 0) {
      ctx.fillStyle = hr % 6 === 0 ? C.mid : C.muted;
      ctx.fillText(String(hr).padStart(2, '0'), Math.min(Math.max(x(i), 10), w - 10), pb + 4);
    }
  }

  const step = (w - PAD_L - PAD_R) / N;
  const barArea = (pb - top) * 0.45;       // Balken nutzen das untere Drittel

  // Sonnenstrahlung: breite, halbtransparente orange Balken
  const maxRad = Math.max(300, ...s.rad.slice(0, N));
  ctx.fillStyle = 'rgba(255,165,0,0.4)';
  for (let i = 0; i < N; i++) {
    if (s.rad[i] <= 0) continue;
    const bh = (s.rad[i] / maxRad) * barArea;
    ctx.fillRect(x(i) - step * 0.32, pb - bh, step * 0.64, bh);
  }

  // Regen: schmale blaue Balken davor, Maximalwert beschriften
  const maxP = Math.max(1.5, ...s.precip.slice(0, N));
  let rainMaxIdx = -1;
  ctx.fillStyle = 'rgba(50,130,255,0.85)';
  for (let i = 0; i < N; i++) {
    if (s.precip[i] <= 0) continue;
    if (rainMaxIdx < 0 || s.precip[i] > s.precip[rainMaxIdx]) rainMaxIdx = i;
    const bh = Math.max(2, (s.precip[i] / maxP) * barArea);
    ctx.fillRect(x(i) - step * 0.18, pb - bh, step * 0.36, bh);
  }
  if (rainMaxIdx >= 0 && s.precip[rainMaxIdx] >= 0.1) {
    ctx.fillStyle = C.blue;
    ctx.font = '700 11px "Barlow Condensed", sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(s.precip[rainMaxIdx].toFixed(1),
      Math.min(Math.max(x(rainMaxIdx), 12), w - 12),
      pb - (s.precip[rainMaxIdx] / maxP) * barArea - 2);
  }

  // Temperaturlinie über den Balken
  const t24 = s.temp.slice(0, N);
  const tMin = Math.min(...t24), tMax = Math.max(...t24);
  const pad = Math.max(1, (tMax - tMin) * 0.15);
  const ty = (v) => {
    const y0 = top + 12, y1 = pb - barArea * 0.5;
    return y1 - ((v - (tMin - pad)) / ((tMax + pad) - (tMin - pad))) * (y1 - y0);
  };
  ctx.beginPath();
  t24.forEach((v, i) => { i === 0 ? ctx.moveTo(x(i), ty(v)) : ctx.lineTo(x(i), ty(v)); });
  ctx.strokeStyle = C.yellow;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;

  // Höchst-/Tiefstwert beschriften
  const hi = t24.indexOf(tMax), lo = t24.indexOf(tMin);
  ctx.font = '700 13px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = C.yellow;
  ctx.textBaseline = 'bottom';
  ctx.fillText(Math.round(tMax) + '°', Math.min(Math.max(x(hi), 14), w - 14), ty(tMax) - 3);
  ctx.fillStyle = C.mid;
  ctx.textBaseline = 'top';
  ctx.fillText(Math.round(tMin) + '°', Math.min(Math.max(x(lo), 14), w - 14), ty(tMin) + 3);

  // Legende
  ctx.font = '10px "Share Tech Mono", monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let lx = PAD_L + 2;
  for (const [t, c] of [['NÄCHSTE 24H', C.mid], ['TEMP', C.yellow],
                        ['SONNE', 'rgba(255,165,0,0.9)'], ['REGEN mm', C.blue]]) {
    ctx.fillStyle = c;
    ctx.fillText(t, lx, 3);
    lx += ctx.measureText(t).width + 9;
  }
}

function drawGraphs() {
  if (!weatherData) return;
  const s = buildSlice(weatherData);
  drawDayGraph(s);
  drawTempGraph(s);
  drawSunGraph(s);
  drawRainGraph(s);
  drawWindGraph(s);
  drawAxis(s);
}

/* ── Regenradar (Rainviewer + Leaflet) ────────────────────── */

let map, radarFrames = [], radarLayers = [], radarIdx = 0, radarTimer = null;
let radarPlaying = true;
let locMarker = null;
let windLayer = null;

function initMap() {
  // Zoom 7 = NRW-Übersicht wie auf dem Dashboard; max. 10, da die
  // RainViewer-Kacheln höhere Zoomstufen nicht unterstützen
  map = L.map('map', { zoomControl: true, attributionControl: true, maxZoom: 10, minZoom: 5 })
    .setView([loc.lat, loc.lon], 7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO &copy; RainViewer &copy; DWD',
    subdomains: 'abcd', maxZoom: 10,
  }).addTo(map);
  locMarker = L.circleMarker([loc.lat, loc.lon], {
    radius: 6, color: C.accent, weight: 2, fillColor: C.accent, fillOpacity: 0.5,
  }).addTo(map);
  windLayer = L.layerGroup().addTo(map);

  let moveTimer;
  map.on('moveend zoomend', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(loadWindArrows, 600);
  });
}

// Windpfeile: Höhenwind (850 hPa ≈ 1,5 km) an einem 4×4-Raster über dem
// Kartenausschnitt – passt zur Zugrichtung der Regenwolken im Radar.
// (Pfeil zeigt, wohin der Wind weht; Größe ~ Windstärke)
async function loadWindArrows() {
  if (!map) return;
  try {
    const b = map.getBounds();
    const lats = [], lons = [];
    const N = 4;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        lats.push((b.getSouth() + (r + 0.5) / N * (b.getNorth() - b.getSouth())).toFixed(3));
        lons.push((b.getWest() + (c + 0.5) / N * (b.getEast() - b.getWest())).toFixed(3));
      }
    }
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    u.search = new URLSearchParams({
      latitude: lats.join(','), longitude: lons.join(','),
      hourly: 'wind_speed_850hPa,wind_direction_850hPa',
      forecast_hours: 1, wind_speed_unit: 'kmh',
    });
    const r = await fetch(u);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let j = await r.json();
    if (!Array.isArray(j)) j = [j];
    windLayer.clearLayers();
    j.forEach((p) => {
      const dir = p.hourly?.wind_direction_850hPa?.[0];
      const spd = p.hourly?.wind_speed_850hPa?.[0];
      if (dir == null || spd == null) return;
      const deg = Math.round(dir) + 180;
      const size = Math.round(13 + Math.min(11, spd / 8));
      L.marker([p.latitude, p.longitude], {
        interactive: false, keyboard: false,
        icon: L.divIcon({
          className: 'wind-arrow', iconSize: [24, 24], iconAnchor: [12, 12],
          html: `<div class="wa" style="transform:rotate(${deg}deg);font-size:${size}px">↑</div>`,
        }),
      }).addTo(windLayer);
    });
  } catch (e) {
    console.error('Windpfeile:', e);
  }
}

// DWD-Radarvorhersage via WMS. Aktueller Layername auf dem DWD-GeoServer:
// Radar_wn-product_1x1km_ger = Radarkomposit (dBZ) + 2 h Nowcast, 5-min-Schritte
const DWD_WMS = 'https://maps.dwd.de/geoserver/dwd/wms';
const DWD_LAYER = 'Radar_wn-product_1x1km_ger';

async function loadRadar() {
  try {
    // Vergangenheit: RainViewer (liefert seit 01/2026 nur noch Vergangenheit,
    // ~2 h in 10-min-Schritten, max. Zoom 7)
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const j = await r.json();
    const past = (j.radar?.past || []).slice(-7).map((f) => ({
      time: f.time,
      layer: L.tileLayer(`${j.host}${f.path}/256/{z}/{x}/{y}/6/1_1.png`, {
        opacity: 0, maxZoom: 10, maxNativeZoom: 7,
      }),
    }));

    // Zukunft: DWD WN-Produkt, +15 bis +120 min in 15-min-Schritten.
    // Basis auf 5-min-Raster abgerundet minus ein Schritt Sicherheitsabstand,
    // da der DWD den neuesten Lauf mit ein paar Minuten Verzögerung publiziert
    const base = Math.floor(Date.now() / 300000) * 300000 - 300000;
    const future = [];
    for (let m = 15; m <= 120; m += 15) {
      const t = base + m * 60000;
      future.push({
        time: Math.round(t / 1000),
        layer: L.tileLayer.wms(DWD_WMS, {
          layers: DWD_LAYER, format: 'image/png', transparent: true,
          version: '1.3.0', opacity: 0, maxZoom: 10,
          time: new Date(t).toISOString().replace(/\.\d{3}Z$/, '.000Z'),
        }),
      });
    }

    const frames = [...past, ...future];
    if (!frames.length) throw new Error('keine Frames');

    // Alte Layer entfernen, neue (unsichtbar) anlegen
    radarLayers.forEach((l) => map.removeLayer(l));
    radarLayers = frames.map((f) => f.layer.addTo(map));
    radarFrames = frames;
    // Index des jüngsten Vergangenheits-Frames = "JETZT"
    let nowIdx = 0;
    frames.forEach((f, i) => { if (f.time * 1000 <= Date.now()) nowIdx = i; });
    $('radarSlider').max = frames.length - 1;
    // JETZT-Markierung auf der Leiste positionieren (16px ≈ Sliderknopf);
    // bleibt unsichtbar, bis sie korrekt sitzt
    const f = frames.length > 1 ? nowIdx / (frames.length - 1) : 0;
    $('nowMark').style.left = `calc(${(f * 100).toFixed(1)}% + ${((0.5 - f) * 16).toFixed(1)}px)`;
    $('nowMark').style.display = 'block';
    showRadarFrame(nowIdx);
    setDot('dotRadar', 'ok');
  } catch (e) {
    console.error('Radar:', e);
    setDot('dotRadar', 'err');
  }
}

function showRadarFrame(i) {
  radarIdx = i;
  radarLayers.forEach((l, k) => l.setOpacity(k === i ? 0.75 : 0));
  const f = radarFrames[i];
  const future = f.time * 1000 > Date.now();
  // Zukunfts-Frames (RainViewer-Vorhersage) als "+XX min" kennzeichnen
  $('radarTime').textContent = future
    ? `+${Math.round((f.time * 1000 - Date.now()) / 60000 / 5) * 5} min`
    : new Date(f.time * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  $('radarTime').classList.toggle('future', future);
  $('radarSlider').value = i;
}

function radarTick() {
  if (!radarFrames.length) return;
  showRadarFrame((radarIdx + 1) % radarFrames.length);
}

function setRadarPlaying(on) {
  radarPlaying = on;
  $('radarPlay').textContent = on ? '⏸' : '▶';
  clearInterval(radarTimer);
  if (on) radarTimer = setInterval(radarTick, 600);
}

$('radarPlay').addEventListener('click', () => setRadarPlaying(!radarPlaying));
$('radarSlider').addEventListener('input', (e) => {
  setRadarPlaying(false);
  showRadarFrame(+e.target.value);
});

/* ── Updates ──────────────────────────────────────────────── */

async function updateWeather() {
  try {
    weatherData = await fetchWeather();
    renderCurrent(weatherData);
    drawGraphs();
    setDot('dotWeather', 'ok');
    $('updatedAt').textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('Wetter:', e);
    setDot('dotWeather', 'err');
  }
}

async function updateAir() {
  try {
    renderAir(await fetchAir());
    setDot('dotAir', 'ok');
  } catch (e) {
    console.error('Luft:', e);
    setDot('dotAir', 'err');
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawGraphs, 150);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateWeather(); updateAir(); loadRadar();
  }
});

/* ── Start ────────────────────────────────────────────────── */

async function main() {
  $('appVersion').textContent = APP_VERSION;
  await initLocation();
  initMap();
  updateWeather();
  updateAir();
  loadRadar();
  loadWindArrows();
  setRadarPlaying(false);   // Standbild (aktuellste Aufnahme); ▶ startet die Animation
  setInterval(updateWeather, REFRESH_WEATHER);
  setInterval(updateAir, REFRESH_WEATHER);
  setInterval(loadRadar, REFRESH_RADAR);
  setInterval(loadWindArrows, REFRESH_WEATHER);
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }));
}
