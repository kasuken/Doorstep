// Tiny HTTP server for the Kindle.
//   GET /dashboard.png  -> fresh 600x800 grayscale PNG (always 200, even if an API is down)
//   GET /               -> preview page (also usable from the Kindle's stock browser)
import { createServer } from "node:http";
import { loadConfig, renderDashboard } from "./render.js";

const cfg = await loadConfig();
const port = Number(process.env.PORT || cfg.port || 8080);

// Coalesce bursts of requests into one render, and reuse it for 5 minutes.
let cached = null;
let cachedAt = 0;
let inflight = null;
async function getPng() {
  if (cached && Date.now() - cachedAt < 5 * 60 * 1000) return cached;
  inflight ??= renderDashboard(cfg)
    .then((png) => ((cached = png), (cachedAt = Date.now()), png))
    .finally(() => (inflight = null));
  return inflight;
}

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>Entrance display</title>
<meta http-equiv="refresh" content="14400">
<style>body{margin:0;background:#fff;text-align:center}img{max-width:100%;height:auto}</style>
</head><body><img src="/dashboard.png" width="600" height="800" alt="Dashboard"></body></html>`;

createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];
  console.log(`${new Date().toISOString()} ${req.socket.remoteAddress} ${req.method} ${path}`);
  try {
    if (path === "/dashboard.png") {
      const png = await getPng();
      res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store", "content-length": png.length });
      return res.end(png);
    }
    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    res.writeHead(404).end("Not found");
  } catch (e) {
    console.error(e);
    res.writeHead(500).end("Render failed");
  }
}).listen(port, () => {
  console.log(`Kindle dashboard on http://localhost:${port}/dashboard.png`);
});
