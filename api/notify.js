// api/notify.js — שליחת מייל סיכום ליד חדש (v2)
// ═══════════════════════════════════════════
// משתמש ב-Resend API (https://resend.com)
// Environment Variable נדרש: RESEND_API_KEY
// ═══════════════════════════════════════════

const LEAD_EMAIL = "Danalonadv@gmail.com";

const ALLOWED_ORIGINS = [
  "https://nifgati.co.il",
  "https://www.nifgati.co.il",
];

// Rate limiting (in-memory — resets on cold start)
const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRate(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  // CORS
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limit
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (!checkRate(ip)) return res.status(429).json({ error: "Too many requests" });

  // Validate
  const { summary, calculation, conversation } = req.body || {};
  if (!summary || typeof summary !== "string") {
    return res.status(400).json({ error: "missing summary" });
  }
  const emailSubject = "ליד חדש — שיחת וואטסאפ | nifgati.co.il";

  // Check for Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured — skipping email notification");
    return res.status(200).json({ ok: true, skipped: true });
  }

  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  const ts = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const calcLine = calculation
    ? `₪${Number(calculation.min).toLocaleString("he-IL")} – ₪${Number(calculation.max).toLocaleString("he-IL")}`
    : "לא חושב";

  // Extract phone from conversation if mentioned
  const allText = Array.isArray(conversation) ? conversation.join(" ") : "";
  const phoneMatch = allText.match(/0[5-9]\d[\d-]{6,9}/);
  const safePhone = phoneMatch ? escapeHtml(phoneMatch[0]) : "לא צוין";

  // Build conversation HTML
  const convoHtml = Array.isArray(conversation)
    ? conversation.map(line => `<p>${escapeHtml(line)}</p>`).join("")
    : "<p>לא זמינה</p>";

  const html = `
    <div style="font-family:Arial,sans-serif;direction:rtl;max-width:600px;margin:0 auto;line-height:1.8">
      <p><strong>שעה:</strong> ${ts}</p>
      <p><strong>טלפון:</strong> ${safePhone}</p>
      <p><strong>סכום משוער:</strong> ${calcLine}</p>
      <hr style="border:none;border-top:1px solid #ccc;margin:16px 0"/>
      <p><strong>השיחה המלאה:</strong></p>
      ${convoHtml}
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "nifgati Bot <nifgati@nifgati.co.il>",
        to: [LEAD_EMAIL],
        subject: emailSubject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      console.error(`Resend API error ${response.status}: ${err.slice(0, 300)}`);
      // Don't fail — this is a background notification
      return res.status(200).json({ ok: true, emailError: true });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Email send error:", err.message);
    // Never fail the user flow for email issues
    return res.status(200).json({ ok: true, emailError: true });
  }
}
