// Renders example screens from made-up data (no network), plus a device mockup
// of the live dashboard. Used for the README screenshots and for quick layout checks.
//   node src/demo.js            -> docs/screenshots/*.png
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfig, renderDashboard } from "./render.js";

const OUT = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));

// Deterministic pseudo-random numbers so screenshots don't change between runs.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function fakeWeather({ date, hour, temp, pop, code, wind = 12, sunrise = "07:40", sunset = "16:50", days }) {
  const dayFrom = +sunrise.slice(0, 2) + 1, dayTo = +sunset.slice(0, 2);
  const time = [], t = [], p = [], c = [], d = [], w = [];
  for (let i = 0; i < 72; i++) {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCHours(i);
    time.push(day.toISOString().slice(0, 13) + ":00");
    t.push(temp(i));
    p.push(pop(i));
    c.push(code(i));
    d.push(i % 24 >= dayFrom && i % 24 <= dayTo ? 1 : 0);
    w.push(wind);
  }
  return {
    location: "Zurich",
    current: {
      time: `${time[hour].slice(0, 13)}:20`,
      temperature_2m: t[hour],
      apparent_temperature: t[hour] - 3,
      weather_code: c[hour],
      wind_speed_10m: wind,
      is_day: d[hour],
    },
    hourly: { time, temperature_2m: t, precipitation_probability: p, weather_code: c, is_day: d, wind_speed_10m: w },
    daily: {
      weather_code: days.map((x) => x.code),
      temperature_2m_max: days.map((x) => x.max),
      temperature_2m_min: days.map((x) => x.min),
      precipitation_probability_max: days.map((x) => x.pop),
      sunrise: days.map(() => `${date}T${sunrise}`),
      sunset: days.map(() => `${date}T${sunset}`),
    },
  };
}

function fakeBitcoin(seed, start, drift) {
  const r = rng(seed);
  const history = [];
  let v = start;
  for (let i = 0; i < 168; i++) history.push((v *= 1 + drift + (r() - 0.5) * 0.012));
  return { currency: "chf", price: Math.round(v), change24h: ((v / history[144] - 1) * 100), history };
}

const wave = (base, amp, peak = 14) => (i) => +(base + amp * Math.cos(((i % 24) - peak) / 24 * 2 * Math.PI)).toFixed(1);

const SCENARIOS = {
  "rainy-morning": {
    now: "2026-11-18T06:05:00Z",
    data: {
      errors: [],
      weather: fakeWeather({
        date: "2026-11-18", hour: 7,
        temp: wave(7, 3), pop: (i) => (i % 24 >= 10 && i % 24 <= 18 ? 80 : 30),
        code: (i) => (i % 24 >= 10 && i % 24 <= 18 ? 63 : 3),
        days: [{ code: 63, max: 10, min: 4, pop: 85 }, { code: 2, max: 9, min: 2, pop: 20 }, { code: 3, max: 8, min: 1, pop: 10 }],
      }),
      bitcoin: fakeBitcoin(7, 55000, 0.0006),
    },
  },
  "snow-day": {
    now: "2026-01-14T06:05:00Z",
    data: {
      errors: [],
      weather: fakeWeather({
        date: "2026-01-14", hour: 7, wind: 18, sunrise: "08:10", sunset: "17:00",
        temp: wave(-2, 2), pop: () => 70, code: (i) => (i % 24 < 12 ? 73 : 71),
        days: [{ code: 73, max: 0, min: -5, pop: 90 }, { code: 71, max: 1, min: -4, pop: 60 }, { code: 0, max: 2, min: -6, pop: 0 }],
      }),
      bitcoin: fakeBitcoin(3, 60000, -0.0008),
    },
  },
  "summer-afternoon": {
    now: "2026-07-08T09:05:00Z",
    data: {
      errors: [],
      weather: fakeWeather({
        date: "2026-07-08", hour: 11, sunrise: "05:42", sunset: "21:20",
        temp: wave(24, 7, 16), pop: () => 5, code: (i) => (i % 24 > 19 ? 1 : 0),
        days: [{ code: 0, max: 31, min: 17, pop: 5 }, { code: 2, max: 29, min: 16, pop: 20 }, { code: 95, max: 26, min: 15, pop: 70 }],
      }),
      bitcoin: fakeBitcoin(11, 52000, 0.0012),
    },
  },
  offline: {
    now: "2026-11-18T10:05:00Z",
    data: { errors: ["weather", "bitcoin"] },
  },
};

// A generic e-reader frame around a dashboard image, with an e-ink paper tint.
async function mockup(pngPath, outPath) {
  const img = await loadImage(pngPath);
  const pad = 70, bottom = 150;
  const W = img.width + pad * 2, H = img.height + pad + bottom;
  const c = createCanvas(W, H);
  const g = c.getContext("2d");
  g.fillStyle = "#2b2b2d";
  g.beginPath();
  g.roundRect(0, 0, W, H, 48);
  g.fill();
  g.fillStyle = "#3a3a3d";
  g.beginPath();
  g.roundRect(10, 10, W - 20, H - 20, 40);
  g.fill();
  g.drawImage(img, pad, pad);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = "#e8e6df"; // e-ink "paper" is never pure white
  g.fillRect(pad, pad, img.width, img.height);
  g.globalCompositeOperation = "source-over";
  // five-way button, as on the non-touch models
  const cx = W / 2, cy = img.height + pad + bottom / 2;
  g.fillStyle = "#222224";
  g.beginPath();
  g.arc(cx, cy, 38, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a4a4e";
  g.beginPath();
  g.arc(cx, cy, 16, 0, Math.PI * 2);
  g.fill();
  await writeFile(outPath, await c.encode("png"));
}

const cfg = { ...(await loadConfig()), city: "Zurich", timezone: "Europe/Zurich", currency: "chf" };
await mkdir(OUT, { recursive: true });

for (const [name, s] of Object.entries(SCENARIOS)) {
  const png = await renderDashboard(cfg, new Date(s.now), s.data);
  await writeFile(`${OUT}${name}.png`, png);
  console.log(`docs/screenshots/${name}.png`);
}

if (!process.argv.includes("--offline")) {
  const live = await renderDashboard(cfg);
  await writeFile(`${OUT}live.png`, live);
  await mockup(`${OUT}live.png`, `${OUT}mockup.png`);
  console.log("docs/screenshots/live.png, docs/screenshots/mockup.png");
}
