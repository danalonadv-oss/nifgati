// api/claude.js — שרת ביניים מאובטח
// ═══════════════════════════════════════════
// אבטחה:
//  1. API Key — Environment Variable בלבד, לא בקוד
//  2. CORS    — רק מהדומיינים המורשים
//  3. Rate Limit — 20 בקשות/דקה לכל IP
//  4. בדיקת גודל — מניעת שימוש לרעה
//  5. אין שמירת מידע — כל בקשה נמחקת מיד
// ═══════════════════════════════════════════

const ALLOWED_ORIGINS = [
  "https://nifgati.co.il",
  "https://www.nifgati.co.il",
  "https://danalonadv.com",
  "https://www.danalonadv.com",
];

// Rate limiting (זיכרון תהליך — מתאפס עם כל deploy)
const rateMap = new Map();
const RATE_LIMIT  = 20;
const RATE_WINDOW = 60_000; // מילישניות

function checkRate(ip) {
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now - rec.start > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT) return false;
  rec.count++;
  return true;
}

export default async function handler(req, res) {
  // ── Security headers ──────────────────────
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  // ── CORS ─────────────────────────────────
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (process.env.NODE_ENV === "development") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // ── Rate limit ────────────────────────────
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (!checkRate(ip)) {
    return res.status(429).json({ error: "יותר מדי בקשות. נסה שוב בעוד דקה." });
  }

  // ── API Key ───────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "שגיאת הגדרות שרת" });
  }

  // ── Validation ────────────────────────────
  const { messages, system } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "פרמטרים שגויים" });
  }
  // מגבלת גודל — מניעת עלויות חריגות
  if (JSON.stringify(messages).length > 20_000) {
    return res.status(400).json({ error: "הודעה ארוכה מדי" });
  }

  // ── Call Anthropic ────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system:     system || "",
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || "שגיאת API" });
    }

    const data = await response.json();
    // ── אין שמירה — מחזיר תשובה ומוחק ────────
    return res.status(200).json(data);

  } catch (err) {
    console.error("API proxy error:", err.message);
    return res.status(500).json({ error: "שגיאת שרת" });
  }
}
