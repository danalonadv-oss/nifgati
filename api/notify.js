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

// Cap the request body — the default Vercel limit (~4.5MB) is far larger
// than any legitimate lead notification and lets an abuser flood Resend.
export const config = {
  api: { bodyParser: { sizeLimit: "64kb" } },
};

const MAX_NAME_LEN = 120;
const MAX_PHONE_LEN = 40;
const MAX_SUMMARY_LEN = 1000;
const MAX_TEXT_LEN = 2500;
const MAX_MSGS = 80;

function tooLong(val, cap) {
  return typeof val === "string" && val.length > cap;
}

// Block header-injection attempts in the email subject.
// Resend likely already sanitizes, but strip locally for belt-and-suspenders.
function cleanSubjectPart(str) {
  return String(str || "").replace(/[\r\n]+/g, " ").slice(0, 120);
}

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

  // Parse body
  const body = req.body || {};

  // Honeypot — reject blind form-fillers.
  if (body.website || body._hp || body.url || body.homepage) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const { summary, calculation, conversation, name, phone, data, msgs } = body;

  if (!summary && !name) {
    return res.status(400).json({ error: "missing lead data" });
  }

  // Field length caps — a lead summary email is small by nature; oversized
  // inputs are either a mistake or abuse (e.g. paste of a long document).
  if (
    tooLong(name, MAX_NAME_LEN) ||
    tooLong(phone, MAX_PHONE_LEN) ||
    tooLong(summary, MAX_SUMMARY_LEN)
  ) {
    return res.status(400).json({ error: "payload too large" });
  }
  if (Array.isArray(conversation)) {
    if (conversation.length > MAX_MSGS) {
      return res.status(400).json({ error: "payload too large" });
    }
    for (const line of conversation) {
      if (tooLong(line, MAX_TEXT_LEN)) {
        return res.status(400).json({ error: "payload too large" });
      }
    }
  }
  if (Array.isArray(msgs)) {
    if (msgs.length > MAX_MSGS) {
      return res.status(400).json({ error: "payload too large" });
    }
    for (const m of msgs) {
      if (m && tooLong(m.content, MAX_TEXT_LEN)) {
        return res.status(400).json({ error: "payload too large" });
      }
    }
  }

  // Check for Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured — skipping email notification");
    return res.status(200).json({ ok: true, skipped: true });
  }

  function esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function fmtNum(n) { return n ? Number(n).toLocaleString("he-IL") : "0"; }

  const ts = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const calc = calculation || body.calc || {};
  const calcMin = calc.min || 0;
  const calcMax = calc.max || 0;
  const safeName = esc(name || "אנונימי");
  const safePhone = esc(phone || "");

  // Extract phone from conversation if not provided directly
  let displayPhone = safePhone;
  if (!displayPhone) {
    const allText = Array.isArray(conversation) ? conversation.join(" ") : "";
    const phoneMatch = allText.match(/0[5-9]\d[\d-]{6,9}/);
    displayPhone = phoneMatch ? esc(phoneMatch[0]) : "לא צוין";
  }

  // Build conversation transcript
  const transcriptHtml = Array.isArray(msgs) && msgs.length > 0
    ? msgs.map(m => `
        <div style="margin-bottom:12px;">
          <strong style="color:${m.role === "user" ? "#b8953a" : "#2a5298"}">
            ${m.role === "user" ? "\u{1F464} לקוח" : "\u{1F916} בוט"}:
          </strong>
          <span style="margin-right:8px;">${esc(m.content)}</span>
        </div>
      `).join("")
    : Array.isArray(conversation)
      ? conversation.map(line => `<p>${esc(line)}</p>`).join("")
      : "<p>לא זמינה</p>";

  const d = data || {};
  const emailSubject = cleanSubjectPart(`\u{1F514} ליד חדש: ${safeName} | ${displayPhone} | \u20AA${fmtNum(calcMin)}\u2013\u20AA${fmtNum(calcMax)}`);

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#b8953a;border-bottom:2px solid #b8953a;padding-bottom:8px;">
        \u{1F514} ליד חדש מהבוט — nifgati.co.il
      </h2>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr style="background:#f5f5f5;">
          <td style="padding:8px;font-weight:bold;">שם</td>
          <td style="padding:8px;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;">טלפון</td>
          <td style="padding:8px;"><a href="tel:${esc(phone || "")}">${displayPhone}</a></td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px;font-weight:bold;">שעה</td>
          <td style="padding:8px;">${ts}</td>
        </tr>
      </table>

      <h3 style="color:#333;">\u{1F4CB} פרטי התאונה</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr style="background:#f5f5f5;">
          <td style="padding:8px;font-weight:bold;">סוג תאונה</td>
          <td style="padding:8px;">${esc(d.role || summary || "לא צוין")}</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;">פנה למיון</td>
          <td style="padding:8px;">${d.medical ? "\u2705 כן" : "\u274C לא"}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px;font-weight:bold;">דרך לעבודה</td>
          <td style="padding:8px;">${d.isWork ? "\u2705 כן" : "\u274C לא"}</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;">סוג פגיעה</td>
          <td style="padding:8px;">${esc(d.injury || "לא צוין")}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px;font-weight:bold;">אחוזי נכות</td>
          <td style="padding:8px;">${d.disability || 0}%</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;">ימי היעדרות</td>
          <td style="padding:8px;">${d.monthsOff || 0} ימים</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px;font-weight:bold;">גיל</td>
          <td style="padding:8px;">${esc(d.age || "לא צוין")}</td>
        </tr>
      </table>

      <h3 style="color:#b8953a;">\u{1F4B0} הערכת פיצוי</h3>
      <div style="background:#1a2a3a;color:#fff;padding:16px;border-radius:8px;text-align:center;margin-bottom:20px;">
        <div style="font-size:24px;font-weight:bold;">
          \u20AA${fmtNum(calcMin)} \u2013 \u20AA${fmtNum(calcMax)}
        </div>
        <div style="color:#aaa;font-size:12px;">לפני שכ"ט</div>
      </div>

      <h3 style="color:#333;">\u{1F4AC} תמליל השיחה</h3>
      <div style="background:#f9f9f9;padding:16px;border-radius:8px;border:1px solid #ddd;">
        ${transcriptHtml}
      </div>

      <hr style="margin:20px 0;border-color:#ddd;">
      <p style="color:#999;font-size:12px;text-align:center;">
        nifgati.co.il | דן אלון, עו"ד נזיקין
      </p>
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
