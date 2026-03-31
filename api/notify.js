// api/notify.js — שליחת מייל סיכום ליד חדש
// ═══════════════════════════════════════════
// משתמש ב-Resend API (https://resend.com)
// Environment Variable נדרש: RESEND_API_KEY
// ═══════════════════════════════════════════

const LEAD_EMAIL = "Danalonadv@gmail.com";

const ALLOWED_ORIGINS = [
  "https://nifgati.co.il",
  "https://www.nifgati.co.il",
];

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  // CORS
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (process.env.NODE_ENV === "development") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Validate
  const { summary, calculation } = req.body || {};
  if (!summary || typeof summary !== "string") {
    return res.status(400).json({ error: "missing summary" });
  }

  // Check for Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured — skipping email notification");
    return res.status(200).json({ ok: true, skipped: true });
  }

  // Build email HTML
  const calcSection = calculation
    ? `<div style="background:#f0f4f8;border-radius:8px;padding:16px;margin:16px 0;font-family:monospace;direction:rtl">
        <strong>אינדיקציה כספית:</strong><br/>
        מינימום: ₪${Number(calculation.min).toLocaleString("he-IL")}<br/>
        מקסימום: ₪${Number(calculation.max).toLocaleString("he-IL")}
      </div>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;direction:rtl;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a84c;border-bottom:2px solid #c9a84c;padding-bottom:8px">🤖 ליד חדש מהבוט — nifgati.co.il</h2>
      ${calcSection}
      <h3>סיכום השיחה:</h3>
      <div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:8px;padding:16px;white-space:pre-wrap;line-height:1.8;direction:rtl">${summary}</div>
      <p style="color:#999;font-size:12px;margin-top:24px">הודעה זו נשלחה אוטומטית מבוט הפיצויים באתר nifgati.co.il. המידע נמחק מהמערכת לאחר השליחה.</p>
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
        from: "בוט נפגעתי <bot@nifgati.co.il>",
        to: [LEAD_EMAIL],
        subject: "ליד חדש מהבוט — סיכום בדיקת פיצויים",
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
