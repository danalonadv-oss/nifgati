// api/claude.js — שרת ביניים מאובטח
// ═══════════════════════════════════════════
import { SYSTEM, MY_NAME, MY_TITLE } from "../src/constants/systemPrompt.js";
import { MEDICAL_SYSTEM } from "../src/constants/medicalSystemPrompt.js";
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
];

// Rate limiting (in-memory — resets on cold start).
// For distributed rate limiting across instances, consider Vercel KV:
//   import { kv } from "@vercel/kv";
//   const key = `rl:${ip}`; const count = await kv.incr(key);
//   if (count === 1) await kv.expire(key, 60);
const rateMap = new Map();
const RATE_LIMIT  = 20;
const RATE_WINDOW = 60_000; // ms

// Periodic cleanup — evict stale entries every 2 minutes
let lastCleanup = Date.now();
function evictStale(now) {
  if (now - lastCleanup < 120_000) return;
  lastCleanup = now;
  for (const [k, v] of rateMap) {
    if (now - v.start > RATE_WINDOW) rateMap.delete(k);
  }
}

function checkRate(ip, res) {
  const now = Date.now();
  evictStale(now);
  const rec = rateMap.get(ip);
  if (!rec || now - rec.start > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
    res.setHeader("X-RateLimit-Remaining", RATE_LIMIT - 1);
    return true;
  }
  if (rec.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((rec.start + RATE_WINDOW - now) / 1000);
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("Retry-After", retryAfter);
    return false;
  }
  rec.count++;
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", RATE_LIMIT - rec.count);
  return true;
}

// Increase Vercel body parser limit for base64 file uploads
export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  // ── Security headers ──────────────────────
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  // ── CORS ─────────────────────────────────
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // ── Rate limit ────────────────────────────
  // Vercel sets x-forwarded-for reliably — safe to trust first IP
  // Do NOT deploy outside Vercel without updating this logic
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (!checkRate(ip, res)) {
    return res.status(429).json({ error: "יותר מדי בקשות. נסה שוב בעוד דקה." });
  }

  // ── API Key ───────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "שגיאת הגדרות שרת" });
  }

  // ── Validation ────────────────────────────
  const { messages, model, domain } = req.body || {};
  const isMedical = domain === "medical";
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "פרמטרים שגויים" });
  }
  // מגבלת מספר הודעות — מניעת ניצול לרעה
  if (messages.length > 30) {
    return res.status(400).json({ error: "יותר מדי הודעות בשיחה." });
  }
  // מגבלת גודל (use Content-Length to avoid serializing base64)
  const contentLen = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLen > 15_000_000) {
    return res.status(400).json({ error: "הודעה ארוכה מדי" });
  }

  // ── Merge consecutive same-role messages (Anthropic requires alternating roles) ──
  const merged = [];
  for (const m of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === m.role) {
      const prev = merged[merged.length - 1];
      // Merge content: both strings → join, otherwise keep last
      if (typeof prev.content === "string" && typeof m.content === "string") {
        prev.content = prev.content + "\n" + m.content;
      } else {
        // If new message has multi-part content (image/doc), replace
        prev.content = m.content;
      }
    } else {
      merged.push({ ...m });
    }
  }

  // ── Ensure first message is user role (Anthropic requirement) ──
  while (merged.length > 0 && merged[0].role !== "user") {
    merged.shift();
  }
  if (merged.length === 0) {
    return res.status(400).json({ error: "פרמטרים שגויים" });
  }

  // ── File type validation (prevent malicious uploads) ──
  const ALLOWED_MEDIA = ["image/jpeg","image/png","image/gif","image/webp","application/pdf",
    "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain"];
  for (const m of merged) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content) {
      if ((part.type === "image" || part.type === "document") && part.source?.media_type) {
        if (!ALLOWED_MEDIA.includes(part.source.media_type)) {
          return res.status(400).json({ error: "סוג קובץ לא נתמך." });
        }
      }
    }
  }

  // ── Prompt injection sanitization ──────
  // Strip sequences that could manipulate system prompt behavior
  // English + Hebrew prompt injection patterns
  const INJECTION_RE = /\b(system|SYSTEM|<\/?system>|<\/?instructions>|ignore previous|forget your|you are now|new instructions|override|disregard)\b|\u05D4\u05EA\u05E2\u05DC\u05DD \u05DE|\u05E9\u05DB\u05D7 \u05D0\u05EA|\u05D0\u05EA\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5|\u05D4\u05D5\u05E8\u05D0\u05D5\u05EA \u05D7\u05D3\u05E9\u05D5\u05EA|\u05E2\u05E7\u05D5\u05E3|\u05D4\u05EA\u05E2\u05DC\u05DE\u05D5\u05EA|\u05D4\u05D5\u05E8\u05D0\u05D5\u05EA \u05E7\u05D5\u05D3\u05DE\u05D5\u05EA|\u05D0\u05EA\u05D4 \u05D1\u05D5\u05D8 \u05D0\u05D7\u05E8|\u05EA\u05EA\u05E0\u05D4\u05D2 \u05DB|\u05E9\u05E0\u05D4 \u05D0\u05EA \u05D4\u05D5\u05E8\u05D0\u05D5\u05EA/gi;
  const sanitized = merged.map(m => {
    if (m.role !== "user") return m;
    if (typeof m.content === "string") {
      return { ...m, content: m.content.replace(INJECTION_RE, "[filtered]") };
    }
    // For multi-part content (images/documents), only sanitize text parts
    if (Array.isArray(m.content)) {
      return { ...m, content: m.content.map(part =>
        part.type === "text" ? { ...part, text: part.text.replace(INJECTION_RE, "[filtered]") } : part
      )};
    }
    return m;
  });

  // מודלים מורשים בלבד
  const ALLOWED_MODELS = [
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-20250514",
  ];
  const selectedModel = ALLOWED_MODELS.includes(model)
    ? model
    : "claude-haiku-4-5-20251001";

  // ── Call Anthropic ────
  // Longer timeout for document/image analysis (Sonnet), shorter for text (Haiku)
  const hasDocContent = merged.some(m =>
    Array.isArray(m.content) && m.content.some(p => p.type === "image" || p.type === "document")
  );
  const timeoutMs = hasDocContent ? 55000 : 25000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Log sanitized message structure for debugging (roles + content types, no data)
  console.log("API request:", JSON.stringify(sanitized.map(m => ({
    role: m.role,
    contentType: typeof m.content === "string" ? "string" : (Array.isArray(m.content) ? m.content.map(p=>p.type) : typeof m.content),
  }))));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      selectedModel,
        max_tokens: isMedical ? 150 : 2000,
        ...(isMedical ? { temperature: 0.2 } : {}),
        system:     isMedical ? MEDICAL_SYSTEM : SYSTEM,
        messages:   sanitized,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Log full error server-side for debugging, return safe message to client
      const errBody = await response.text().catch(() => "");
      console.error(`Anthropic API ${response.status}: ${errBody.slice(0, 500)}`);
      const status = response.status;
      if (status === 429) return res.status(429).json({ error: "יותר מדי בקשות — נסה שוב בעוד דקה." });
      if (status === 413) return res.status(400).json({ error: "הקובץ גדול מדי לעיבוד." });
      if (status === 400) {
        // Return a debug hint from Anthropic's error while keeping it safe
        let hint = "";
        try {
          const parsed = JSON.parse(errBody);
          hint = parsed?.error?.message || "";
        } catch(_) {}
        console.error("Anthropic 400 detail:", hint);
        // Map known errors to Hebrew messages
        if (/must.*(alternate|user.*assistant)/i.test(hint)) return res.status(400).json({ error: "שגיאה במבנה השיחה — נסה לפתוח שיחה חדשה." });
        if (/too large|size/i.test(hint)) return res.status(400).json({ error: "הקובץ גדול מדי — נסה קובץ קטן יותר." });
        if (/media_type|invalid.*type/i.test(hint)) return res.status(400).json({ error: "סוג קובץ לא נתמך — נסה PDF או תמונה." });
        if (/base64|decode|data/i.test(hint)) return res.status(400).json({ error: "שגיאה בקריאת הקובץ — נסה להעלות שוב." });
        // Unknown 400 — generic error (do not expose Anthropic details)
        return res.status(400).json({ error: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E2\u05D9\u05D1\u05D5\u05D3 \u05D4\u05D1\u05E7\u05E9\u05D4 \u2014 \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1." });
      }
      return res.status(502).json({ error: "שגיאת שרת — נסה שוב." });
    }

    const data = await response.json();

    // Handle empty or malformed response
    if (!data?.content?.length || !data.content[0]?.text) {
      return res.status(502).json({ error: "תשובה ריקה מהשרת — נסה שוב." });
    }

    return res.status(200).json(data);

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "הבקשה ארכה יותר מדי זמן — נסה שוב." });
    }
    console.error("API proxy error:", err.message);
    return res.status(500).json({ error: "שגיאת שרת" });
  }
}
