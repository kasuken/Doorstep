// Renders the entrance dashboard as a 600x800 8-bit grayscale PNG.
// CLI:  node src/render.js [out.png]      (default: out/dashboard.png)
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadData } from "./data.js";
import { encodeGrayPng } from "./png.js";
import { drawIcon, iconKind, describe, isWet, isSnow, isThunder } from "./icons.js";

export const WIDTH = 600;
export const HEIGHT = 800;
const M = 28; // side margin

const FAMILY =
  ["Segoe UI", "DejaVu Sans", "Liberation Sans", "Arial", "Helvetica"].find((f) =>
    GlobalFonts.has(f)
  ) || "sans-serif";
const font = (size, weight = 400) => `${weight} ${size}px "${FAMILY}"`;

export async function loadConfig() {
  const path = fileURLToPath(new URL("../config.json", import.meta.url));
  return JSON.parse(await readFile(path, "utf8"));
}

// ---------- small helpers ----------
const deg = (t) => (t == null || Number.isNaN(t) ? "—" : `${Math.round(t) === 0 ? 0 : Math.round(t)}°`.replace("-", "−"));
const hhmm = (iso) => (iso ? iso.slice(11, 16) : "—");

function localParts(date, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return { weekday: p.weekday, day: p.day, month: p.month, hour: +p.hour, time: `${p.hour}:${p.minute}` };
}

function nextRefresh(hours, currentHour) {
  const sorted = [...hours].sort((a, b) => a - b);
  const h = sorted.find((x) => x > currentHour) ?? sorted[0];
  return `${String(h).padStart(2, "0")}:00`;
}

function fitText(ctx, text, maxWidth, size, weight) {
  let s = size;
  ctx.font = font(s, weight);
  while (s > 10 && ctx.measureText(text).width > maxWidth) ctx.font = font(--s, weight);
  return s;
}

function text(ctx, str, x, y, size, { weight = 400, align = "left", color = "#000", base = "alphabetic", max } = {}) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (max) fitText(ctx, str, max, size, weight);
  else ctx.font = font(size, weight);
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

function hline(ctx, y, x1 = M, x2 = WIDTH - M, w = 3) {
  ctx.fillStyle = "#000";
  ctx.fillRect(x1, y, x2 - x1, w);
}

function triangle(ctx, x, y, size, up) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x + size, y + size);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.lineTo(x + size, y);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------- "what to bring" advice for the next ~12 hours ----------
export function advice(w, startIdx) {
  const h = w.hourly;
  const end = Math.min(startIdx + 12, h.time.length);
  let maxPop = 0, popAt = null, minT = Infinity, maxT = -Infinity, maxWind = 0;
  let wet = false, snow = false, thunder = false;
  for (let i = startIdx; i < end; i++) {
    const pop = h.precipitation_probability[i] ?? 0;
    if (pop > maxPop) { maxPop = pop; popAt = h.time[i]; }
    minT = Math.min(minT, h.temperature_2m[i]);
    maxT = Math.max(maxT, h.temperature_2m[i]);
    maxWind = Math.max(maxWind, h.wind_speed_10m?.[i] ?? 0);
    const c = h.weather_code[i];
    if (isWet(c)) wet = true;
    if (isSnow(c)) snow = true;
    if (isThunder(c)) thunder = true;
  }

  const items = [];
  if (thunder) items.push("Umbrella (storms)");
  else if (snow) items.push("Snow boots");
  else if (maxPop >= 50 || (wet && maxPop >= 30)) items.push("Take an umbrella");

  if (minT <= 0) items.push("Hat & gloves");
  else if (minT <= 8) items.push("Warm coat");
  else if (minT <= 15) items.push("Light jacket");
  else if (maxT >= 28) items.push("Bring water");

  if (maxWind >= 40 && items.length < 2) items.push("Windy");

  const title = items.length
    ? items.slice(0, 2).map((t, i) => (i ? t[0].toLowerCase() + t.slice(1) : t)).join(" + ")
    : "Nice out — go as you are";
  const details = [];
  if (maxPop >= 30 && popAt)
    details.push(`${maxPop}% ${snow && !wet ? "snow" : "rain"} chance ${popAt === h.time[startIdx] ? "right now" : `around ${hhmm(popAt)}`}`);
  else details.push("Dry for the next 12 hours");
  details.push(`${deg(minT)} to ${deg(maxT)}`);
  return { title, detail: details.join(" · ") };
}

// ---------- sections ----------
function drawHeader(ctx, now, cfg, data) {
  const p = localParts(now, cfg.timezone);
  text(ctx, p.weekday, M, 58, 46, { weight: 700 });
  text(ctx, `${p.day} ${p.month}`, M, 94, 28);
  const place = data.weather?.location || cfg.city || "";
  text(ctx, place, WIDTH - M, 52, 24, { align: "right", weight: 700, max: 220 });
  text(ctx, `Updated ${p.time}`, WIDTH - M, 78, 19, { align: "right", color: "#333" });
  // +30 min: an image rendered just before a wake-up is shown until the one after.
  const soon = localParts(new Date(now.getTime() + 30 * 60 * 1000), cfg.timezone);
  text(ctx, `Next ${nextRefresh(cfg.refreshHours, soon.hour)}`, WIDTH - M, 100, 19, { align: "right", color: "#333" });
  hline(ctx, 112);
}

function currentIndex(w) {
  const prefix = w.current.time.slice(0, 13);
  const i = w.hourly.time.findIndex((t) => t.startsWith(prefix));
  return i < 0 ? 0 : i;
}

function drawWeather(ctx, w, top) {
  if (!w) {
    text(ctx, "Weather unavailable", WIDTH / 2, top + 120, 34, { align: "center", weight: 700 });
    return top + 430;
  }
  const c = w.current;
  const d = w.daily;
  const idx = currentIndex(w);

  // Hero: icon + temperature
  drawIcon(ctx, iconKind(c.weather_code, c.is_day), M + 80, top + 92, 150);
  const tx = M + 190;
  text(ctx, deg(c.temperature_2m), tx, top + 118, 112, { weight: 700 });
  text(ctx, describe(c.weather_code), tx, top + 154, 27, { weight: 700, max: WIDTH - M - tx });
  text(ctx, `Feels ${deg(c.apparent_temperature)} · Wind ${Math.round(c.wind_speed_10m)} km/h`, tx, top + 184, 20, {
    color: "#222", max: WIDTH - M - tx,
  });
  text(
    ctx,
    `High ${deg(d.temperature_2m_max[0])}  Low ${deg(d.temperature_2m_min[0])}  Rain ${d.precipitation_probability_max[0] ?? 0}%`,
    tx, top + 210, 20, { color: "#222", max: WIDTH - M - tx }
  );

  // Advice banner (inverted)
  const a = advice(w, idx);
  const by = top + 226;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(M, by, WIDTH - 2 * M, 76, 12);
  ctx.fill();
  text(ctx, a.title, WIDTH / 2, by + 38, 32, { weight: 700, align: "center", color: "#fff", max: WIDTH - 2 * M - 30 });
  text(ctx, a.detail, WIDTH / 2, by + 64, 19, { align: "center", color: "#fff", max: WIDTH - 2 * M - 30 });

  // Hourly strip (next 12h, every 3h) + tomorrow
  const sy = by + 90;
  const colW = 96;
  for (let k = 0; k < 4; k++) {
    const i = Math.min(idx + 1 + k * 3, w.hourly.time.length - 1);
    const cx = M + colW * k + colW / 2;
    text(ctx, hhmm(w.hourly.time[i]), cx, sy + 20, 20, { align: "center", weight: 700 });
    drawIcon(ctx, iconKind(w.hourly.weather_code[i], w.hourly.is_day[i]), cx, sy + 60, 54);
    text(ctx, deg(w.hourly.temperature_2m[i]), cx, sy + 116, 28, { align: "center", weight: 700 });
    text(ctx, `${w.hourly.precipitation_probability[i] ?? 0}%`, cx, sy + 140, 18, { align: "center", color: "#333" });
  }
  const tomX = M + colW * 4 + 14;
  ctx.fillStyle = "#000";
  ctx.fillRect(tomX - 8, sy + 4, 3, 140);
  const tcx = tomX + (WIDTH - M - tomX) / 2;
  text(ctx, "Tomorrow", tcx, sy + 20, 20, { align: "center", weight: 700 });
  drawIcon(ctx, iconKind(d.weather_code[1], 1), tcx, sy + 60, 54);
  text(ctx, `${deg(d.temperature_2m_max[1])} / ${deg(d.temperature_2m_min[1])}`, tcx, sy + 116, 25, {
    align: "center", weight: 700,
  });
  text(ctx, `${d.precipitation_probability_max[1] ?? 0}% rain`, tcx, sy + 140, 18, { align: "center", color: "#333" });

  return sy + 152;
}

function drawBitcoin(ctx, b, top) {
  hline(ctx, top);
  const y = top + 12;
  text(ctx, "BITCOIN", M, y + 20, 19, { weight: 700, color: "#333" });
  if (!b) {
    text(ctx, "—", M, y + 84, 56, { weight: 700 });
    return;
  }
  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: b.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(b.price);
  text(ctx, money, M, y + 76, 52, { weight: 700, max: 300 });
  const ch = b.change24h ?? 0;
  triangle(ctx, M, y + 92, 18, ch >= 0);
  text(ctx, `${Math.abs(ch).toFixed(1)}% in 24h`, M + 28, y + 110, 22, { weight: 700 });

  // 7-day sparkline
  const hist = b.history || [];
  if (hist.length > 1) {
    const x0 = 350, x1 = WIDTH - M, y0 = y + 10, y1 = y + 98;
    const lo = Math.min(...hist), hi = Math.max(...hist);
    const span = hi - lo || 1;
    const px = (i) => x0 + ((x1 - x0) * i) / (hist.length - 1);
    const py = (v) => y1 - ((y1 - y0) * (v - lo)) / span;
    ctx.beginPath();
    ctx.moveTo(px(0), y1);
    hist.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(hist.length - 1), y1);
    ctx.closePath();
    ctx.fillStyle = "#c8c8c8";
    ctx.fill();
    ctx.beginPath();
    hist.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.fillRect(x0, y1, x1 - x0, 2);
    text(ctx, "7 days", x0, y1 + 20, 16, { color: "#333" });
    const k = (v) => `${Math.round(v / 1000)}k`;
    text(ctx, `${k(lo)} – ${k(hi)}`, x1, y1 + 20, 16, { align: "right", color: "#333" });
  }
}

function drawFooter(ctx, data, cfg) {
  const w = data.weather;
  const y = HEIGHT - 22;
  hline(ctx, HEIGHT - 52, M, WIDTH - M, 2);
  let left = w ? `Sunrise ${hhmm(w.daily.sunrise[0])}  ·  Sunset ${hhmm(w.daily.sunset[0])}` : "";
  text(ctx, left, M, y, 20, { color: "#222" });
  const stale = [];
  for (const k of ["weather", "bitcoin"]) {
    const at = data[`${k}StaleSince`];
    if (at) stale.push(`${k} from ${localParts(new Date(at), cfg.timezone).time}`);
    else if (data.errors.includes(k)) stale.push(`${k} offline`);
  }
  if (stale.length) text(ctx, `Offline: ${stale.join(", ")}`, WIDTH - M, y, 17, { align: "right", weight: 700, max: 250 });
}

export async function renderDashboard(cfg, now = new Date(), data = null) {
  data ??= await loadData(cfg);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawHeader(ctx, now, cfg, data);
  const after = drawWeather(ctx, data.weather, 118);
  drawBitcoin(ctx, data.bitcoin, after + 6);
  drawFooter(ctx, data, cfg);

  const { data: rgba } = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  return encodeGrayPng(rgba, WIDTH, HEIGHT);
}

// CLI entry point
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const out = resolve(process.argv[2] || "out/dashboard.png");
  const cfg = await loadConfig();
  const png = await renderDashboard(cfg);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, png);
  console.log(`Wrote ${out} (${png.length} bytes, font: ${FAMILY})`);
}
