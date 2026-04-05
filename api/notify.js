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

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  // CORS
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Validate
  const { summary, calculation, subject, phone, injury } = req.body || {};
  if (!summary || typeof summary !== "string") {
    return res.status(400).json({ error: "missing summary" });
  }
  const emailSubject = "ליד חדש 🔥 nifgati.co.il";

  // Check for Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured — skipping email notification");
    return res.status(200).json({ ok: true, skipped: true });
  }

  // Build short plain-text email
  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  const ts = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const safePhone = escapeHtml(phone || "לא צוין");
  const safeInjury = escapeHtml(injury || "לא צוין");
  const calcLine = calculation
    ? `₪${Number(calculation.min).toLocaleString("he-IL")} – ₪${Number(calculation.max).toLocaleString("he-IL")}`
    : "לא חושב";

  const html = `
    <div style="font-family:Arial,sans-serif;direction:rtl;max-width:500px;margin:0 auto;line-height:2">
      <p>טלפון: ${safePhone}</p>
      <p>פגיעה: ${safeInjury}</p>
      <p>פיצוי משוער: ${calcLine}</p>
      <p>שעה: ${ts}</p>
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
