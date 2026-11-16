// Weather icons drawn with thick black strokes, so they stay crisp on e-ink.

const DESCRIPTIONS = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm, hail", 99: "Thunderstorm, hail",
};

export const describe = (code) => DESCRIPTIONS[code] ?? "—";

export function iconKind(code, isDay = 1) {
  if (code == null) return "unknown";
  if (code === 0 || code === 1) return isDay ? "sun" : "moon";
  if (code === 2) return isDay ? "partly-day" : "partly-night";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 66 || code === 67) return "sleet";
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "cloud";
}

export const isWet = (code) => code >= 51 && code <= 99 && !(code >= 71 && code <= 77) && code !== 85 && code !== 86;
export const isSnow = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;
export const isThunder = (code) => code >= 95;

function sun(ctx, cx, cy, r, lw) {
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
}

function moon(ctx, cx, cy, r) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx + r * 0.35, cy - r * 0.25, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
}

// Cloud = union of circles. Outline via "draw black slightly bigger, then white".
function cloud(ctx, cx, cy, w, lw, fill = "#fff") {
  const parts = [
    [-0.28, 0.08, 0.22],
    [-0.02, -0.1, 0.3],
    [0.27, 0.06, 0.22],
  ];
  const draw = (grow, style) => {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (const [dx, dy, rr] of parts) {
      ctx.moveTo(cx + dx * w + rr * w + grow, cy + dy * w);
      ctx.arc(cx + dx * w, cy + dy * w, rr * w + grow, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.rect(cx - 0.28 * w, cy + 0.08 * w - grow, 0.55 * w, 0.22 * w + grow * 2);
    ctx.fill();
  };
  draw(lw, "#000");
  draw(0, fill);
}

export function drawIcon(ctx, kind, cx, cy, size) {
  const lw = Math.max(2, size / 16);
  const r = size / 2;
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;

  const cloudTop = (dy = -0.12) => cloud(ctx, cx, cy + dy * size, size * 0.95, lw);
  const lines = (n, len, slant, dash) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * size * 0.22;
      const y = cy + size * 0.24;
      ctx.beginPath();
      if (dash) {
        ctx.arc(x, y + size * 0.06, lw * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = "#000";
        ctx.fill();
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x - slant * size, y + len * size);
        ctx.stroke();
      }
    }
  };
  const flakes = () => {
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * size * 0.25;
      const y = cy + size * 0.33 + (i % 2) * size * 0.06;
      const s = size * 0.07;
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        ctx.stroke();
      }
    }
  };

  switch (kind) {
    case "sun":
      sun(ctx, cx, cy, r * 0.9, lw);
      break;
    case "moon":
      moon(ctx, cx, cy, r);
      break;
    case "partly-day":
      sun(ctx, cx - size * 0.15, cy - size * 0.15, r * 0.6, lw);
      cloud(ctx, cx + size * 0.08, cy + size * 0.12, size * 0.8, lw);
      break;
    case "partly-night":
      moon(ctx, cx - size * 0.12, cy - size * 0.16, r * 0.7);
      cloud(ctx, cx + size * 0.08, cy + size * 0.12, size * 0.8, lw);
      break;
    case "cloud":
      cloud(ctx, cx, cy + size * 0.02, size * 1.0, lw);
      break;
    case "fog":
      cloud(ctx, cx, cy - size * 0.14, size * 0.85, lw);
      for (let i = 0; i < 3; i++) {
        const y = cy + size * (0.2 + i * 0.12);
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.38 + (i % 2) * size * 0.08, y);
        ctx.lineTo(cx + size * 0.38 - ((i + 1) % 2) * size * 0.08, y);
        ctx.stroke();
      }
      break;
    case "drizzle":
      cloudTop();
      lines(3, 0, 0, true);
      break;
    case "rain":
      cloudTop();
      lines(3, 0.2, 0.06);
      break;
    case "sleet":
      cloudTop();
      lines(2, 0.18, 0.05);
      flakes();
      break;
    case "snow":
      cloudTop();
      flakes();
      break;
    case "thunder": {
      cloudTop(-0.16);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      const s = size;
      ctx.moveTo(cx + 0.04 * s, cy + 0.1 * s);
      ctx.lineTo(cx - 0.12 * s, cy + 0.32 * s);
      ctx.lineTo(cx - 0.0 * s, cy + 0.32 * s);
      ctx.lineTo(cx - 0.08 * s, cy + 0.5 * s);
      ctx.lineTo(cx + 0.14 * s, cy + 0.24 * s);
      ctx.lineTo(cx + 0.02 * s, cy + 0.24 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      ctx.font = `bold ${size * 0.6}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      ctx.fillText("?", cx, cy);
  }
  ctx.restore();
}
