// Fetches weather (Open-Meteo) and Bitcoin (CoinGecko). Both are free and keyless.
// Each source fails independently; the last good result is cached on disk so a
// flaky API shows slightly old data instead of a blank panel.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CACHE_FILE = fileURLToPath(new URL("../.cache.json", import.meta.url));
const TIMEOUT_MS = 12000;

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "kindle-entrance-display/1.0" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${new URL(url).host}`);
  return res.json();
}

async function resolveLocation(cfg) {
  if (cfg.latitude != null && cfg.longitude != null) {
    return { name: cfg.city || "Home", latitude: cfg.latitude, longitude: cfg.longitude };
  }
  const q = encodeURIComponent(cfg.city);
  const geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1`);
  const hit = geo.results?.[0];
  if (!hit) throw new Error(`City not found: ${cfg.city}`);
  return { name: hit.name, latitude: hit.latitude, longitude: hit.longitude };
}

async function fetchWeather(cfg) {
  const loc = await resolveLocation(cfg);
  const params = new URLSearchParams({
    latitude: loc.latitude,
    longitude: loc.longitude,
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: cfg.timezone || "auto",
    forecast_days: "3",
  });
  const w = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  return { location: loc.name, ...w };
}

async function fetchBitcoin(cfg) {
  const cur = (cfg.currency || "eur").toLowerCase();
  const [price, chart] = await Promise.all([
    getJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${cur}&include_24hr_change=true`
    ),
    getJson(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=${cur}&days=7`),
  ]);
  return {
    currency: cur,
    price: price.bitcoin[cur],
    change24h: price.bitcoin[`${cur}_24h_change`],
    history: chart.prices.map(([, p]) => p),
  };
}

async function readCache() {
  try {
    return JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function loadData(cfg) {
  const cache = await readCache();
  const now = new Date().toISOString();
  const [weather, bitcoin] = await Promise.allSettled([fetchWeather(cfg), fetchBitcoin(cfg)]);

  const out = { errors: [] };
  for (const [key, result] of [
    ["weather", weather],
    ["bitcoin", bitcoin],
  ]) {
    if (result.status === "fulfilled") {
      out[key] = result.value;
      cache[key] = { value: result.value, at: now };
    } else {
      console.error(`[${key}] ${result.reason?.message || result.reason}`);
      out.errors.push(key);
      if (cache[key]) {
        out[key] = cache[key].value;
        out[`${key}StaleSince`] = cache[key].at;
      }
    }
  }
  try {
    await writeFile(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.error(`[cache] ${e.message}`);
  }
  return out;
}
