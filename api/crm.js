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
function colLetter(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function appendRow(accessToken, spreadsheetId, sheetName, values) {
  const range = encodeURIComponent(`${sheetName}!A:${colLetter(values.length)}`);
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

// Rate limiting (in-memory — resets on cold start)
const rateMap = new Map();
const RATE_LIMIT = 20;
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

// Prevent CSV/formula injection in Google Sheets
function sanitizeCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) return "'" + str;
  return str;
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

  const {
    // pl"t fields
    name, phone, accidentType, hospitalized, workAccident,
    age, disability, compensationRange, page, whatsappClick, utmSource, gclid,
    // medical fields
    domain, case_type, free_text, detected_categories, incident_date, discovery_date,
    sol_remaining_months, sol_bucket, has_permanent_damage, has_medical_records,
    institution_type, user_agent,
  } = req.body || {};

  const isMedical = domain === "medical";

  // Required-field guard per domain
  if (isMedical) {
    if (!name || !phone) {
      return res.status(400).json({ error: "missing lead data" });
    }
  } else if (!accidentType && !whatsappClick) {
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

  const row = isMedical ? [
    ts,                                                                          // A: timestamp
    "medical",                                                                   // B: domain
    sanitizeCell(name),                                                          // C: name
    sanitizeCell(phone),                                                         // D: phone
    sanitizeCell(case_type),                                                     // E: case_type
    sanitizeCell(free_text),                                                     // F: free_text
    sanitizeCell(JSON.stringify(detected_categories || [])),                     // G: detected_categories (JSON)
    sanitizeCell(incident_date),                                                 // H: incident_date
    sanitizeCell(discovery_date),                                                // I: discovery_date
    sol_remaining_months == null ? "" : String(sol_remaining_months),            // J: sol_remaining_months
    sanitizeCell(sol_bucket),                                                    // K: sol_bucket
    sanitizeCell(has_permanent_damage),                                          // L: has_permanent_damage
    sanitizeCell(has_medical_records),                                           // M: has_medical_records
    sanitizeCell(institution_type),                                              // N: institution_type
    sanitizeCell(gclid),                                                         // O: gclid
    sanitizeCell(user_agent),                                                    // P: user_agent
  ] : [
    ts,                                                                          // A: תאריך ושעה
    sanitizeCell(name),                                                          // B: שם
    sanitizeCell(phone),                                                         // C: טלפון
    sanitizeCell(accidentType),                                                  // D: סוג תאונה
    hospitalized != null ? (hospitalized ? "כן" : "לא") : "",                    // E: אושפז
    workAccident != null ? (workAccident ? "כן" : "לא") : "",                    // F: תאונת עבודה
    sanitizeCell(age),                                                           // G: גיל
    disability != null ? `${disability}%` : "",                                  // H: אחוזי נכות
    sanitizeCell(compensationRange),                                             // I: טווח פיצוי
    sanitizeCell(page),                                                          // J: דף נחיתה
    whatsappClick ? "כן" : "לא",                                                 // K: לחץ WhatsApp
    sanitizeCell(utmSource),                                                     // L: מקור
    sanitizeCell(gclid),                                                         // M: GCLID
  ];

  const sheetName = isMedical
    ? (process.env.GOOGLE_SHEET_NAME_MEDICAL || "Medical")
    : (process.env.GOOGLE_SHEET_NAME || "Sheet1");

  try {
    const token = await getAccessToken(clientEmail, privateKey);
    await appendRow(token, spreadsheetId, sheetName, row);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("CRM error:", err.message);
    // Never fail the user flow for CRM issues
    return res.status(200).json({ ok: true, crmError: true });
  }
}
