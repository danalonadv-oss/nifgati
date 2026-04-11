// api/crm.js — Save lead data to Google Sheets CRM
// ═══════════════════════════════════════════════════
// Environment Variables:
//   GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_SPREADSHEET_ID
// ═══════════════════════════════════════════════════

import crypto from "crypto";

const ALLOWED_ORIGINS = [
  "https://nifgati.co.il",
  "https://www.nifgati.co.il",
];

const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── JWT helper (RS256, no external deps) ──
function createJwt(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signInput = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(signInput).sign(privateKey, "base64url");
  return `${signInput}.${signature}`;
}

// ── Get access token from Google ──
async function getAccessToken(clientEmail, privateKey) {
  const jwt = createJwt(clientEmail, privateKey);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Token error ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ── Append row to Google Sheets ──
async function appendRow(accessToken, spreadsheetId, sheetName, values) {
  const range = encodeURIComponent(`${sheetName}!A:L`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Sheets API error ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

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

  const {
    name, phone, accidentType, hospitalized, workAccident,
    age, disability, compensationRange, page, whatsappClick, utmSource,
  } = req.body || {};

  // At minimum need some lead data
  if (!accidentType && !whatsappClick) {
    return res.status(400).json({ error: "missing lead data" });
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.error("Google Sheets env vars not configured — skipping CRM");
    return res.status(200).json({ ok: true, skipped: true });
  }

  const ts = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

  const row = [
    ts,                                              // A: תאריך ושעה
    name || "",                                      // B: שם
    phone || "",                                     // C: טלפון
    accidentType || "",                              // D: סוג תאונה
    hospitalized != null ? (hospitalized ? "כן" : "לא") : "",  // E: אושפז
    workAccident != null ? (workAccident ? "כן" : "לא") : "",  // F: תאונת עבודה
    age || "",                                       // G: גיל
    disability != null ? `${disability}%` : "",      // H: אחוזי נכות
    compensationRange || "",                         // I: טווח פיצוי
    page || "",                                      // J: דף נחיתה
    whatsappClick ? "כן" : "לא",                     // K: לחץ WhatsApp
    utmSource || "",                                 // L: מקור
  ];

  try {
    const token = await getAccessToken(clientEmail, privateKey);
    await appendRow(token, spreadsheetId, process.env.GOOGLE_SHEET_NAME || "Sheet1", row);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("CRM error:", err.message);
    // Never fail the user flow for CRM issues
    return res.status(200).json({ ok: true, crmError: true });
  }
}
