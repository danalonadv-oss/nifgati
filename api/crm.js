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

// Ensure a sheet tab exists (best-effort — logs and swallows errors so it can't
// block a lead write). Creates the tab with a header row if missing.
async function ensureSheetExists(accessToken, spreadsheetId, sheetName, headers) {
  try {
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`;
    const meta = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!meta.ok) return;
    const data = await meta.json();
    const exists = (data.sheets || []).some(s => s.properties?.title === sheetName);
    if (exists) return;
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(batchUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
    });
    if (headers?.length) {
      const headerRange = encodeURIComponent(`${sheetName}!A1:${colLetter(headers.length)}1`);
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [headers] }),
      });
    }
  } catch (e) {
    console.error("ensureSheetExists failed:", e.message);
  }
}

const MEDICAL_HEADERS = [
  "timestamp","domain","name","phone","case_type","free_text",
  "detected_categories","incident_date","discovery_date","sol_remaining_months",
  "sol_bucket","has_permanent_damage","has_medical_records","institution_type",
  "gclid","user_agent",
];

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

// Field length caps — reject oversized submissions before they hit the sheet
const MAX_NAME_LEN = 120;
const MAX_PHONE_LEN = 40;
const MAX_SHORT_LEN = 200;
const MAX_FREETEXT_LEN = 2500;

function tooLong(val, cap) {
  return typeof val === "string" && val.length > cap;
}

// Prevent CSV/formula injection in Google Sheets
function sanitizeCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) return "'" + str;
  return str;
}

// ── Lead scoring — internal only, never returned to user ──
function computeLeadScore(body) {
  const yrs = body.yearsSinceAccident;
  const ageNum = body.age ? parseInt(body.age) : null;
  const isMinor = ageNum != null && ageNum < 18;
  const solCap = isMinor ? 25 : 7;

  // Hard disqualification gates
  if (yrs != null && yrs > solCap) {
    return { score: 0, tier: "REJECT", gate: "REJECTED_SOL" };
  }
  const hasInjury = !!body.hasInjury ||
                    !!body.injury ||
                    body.hospitalized === true ||
                    (body.hospitalizationDays != null && Number(body.hospitalizationDays) > 0) ||
                    (body.disability != null && Number(body.disability) > 0);
  if (!hasInjury && body.accidentType) {
    return { score: 0, tier: "REJECT", gate: "REJECTED_NO_INJURY" };
  }

  let s = 0;
  if (body.hospitalized === true || (body.hospitalizationDays != null && Number(body.hospitalizationDays) > 0)) s += 25;
  if (body.disability != null && Number(body.disability) > 0) s += 20;
  if (body.workAccident === true) s += 15;
  if (ageNum != null && ageNum < 40) s += 10;
  if (body.hasDocs === true) s += 10;
  if (body.monthsOff != null && Number(body.monthsOff) > 0) s += 8;
  if (yrs != null) {
    if (yrs < 1) s += 8;
    else if (yrs <= 3) s += 5;
    else if (yrs <= 7) s += 2;
  }
  s = Math.min(s, 100);

  let tier;
  if (s >= 70) tier = "CHASE_HARD";
  else if (s >= 40) tier = "CHASE";
  else if (s >= 20) tier = "REFER";
  else tier = "REJECT";
  return { score: s, tier, gate: null };
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

  const body = req.body || {};

  // Honeypot — legitimate frontend never sends these fields. Bots that
  // auto-fill every form input will trip and be rejected silently-looking.
  if (body.website || body._hp || body.url || body.homepage) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const {
    // pl"t fields
    name, phone, accidentType, hospitalized, workAccident,
    age, disability, compensationRange, page, whatsappClick, utmSource, gclid,
    // medical fields
    domain, case_type, free_text, detected_categories, incident_date, discovery_date,
    sol_remaining_months, sol_bucket, has_permanent_damage, has_medical_records,
    institution_type, user_agent,
  } = body;

  const isMedical = domain === "medical";

  // Field length caps — protect the sheet + downstream readers from
  // oversized submissions (deliberate spam or accidental paste of a document).
  if (
    tooLong(name, MAX_NAME_LEN) ||
    tooLong(phone, MAX_PHONE_LEN) ||
    tooLong(accidentType, MAX_SHORT_LEN) ||
    tooLong(case_type, MAX_SHORT_LEN) ||
    tooLong(institution_type, MAX_SHORT_LEN) ||
    tooLong(sol_bucket, MAX_SHORT_LEN) ||
    tooLong(compensationRange, MAX_SHORT_LEN) ||
    tooLong(free_text, MAX_FREETEXT_LEN) ||
    tooLong(user_agent, 500) ||
    tooLong(page, 200) ||
    tooLong(utmSource, 200) ||
    tooLong(gclid, 500)
  ) {
    return res.status(400).json({ error: "payload too large" });
  }

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
  ] : (() => {
    const scored = computeLeadScore(body);
    return [
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
      sanitizeCell(scored.gate || scored.score),                                   // N: score (or gate tag)
      sanitizeCell(scored.tier),                                                   // O: tier
    ];
  })();

  const sheetName = isMedical
    ? (process.env.GOOGLE_SHEET_NAME_MEDICAL || "Medical")
    : (process.env.GOOGLE_SHEET_NAME || "Sheet1");

  try {
    const token = await getAccessToken(clientEmail, privateKey);
    if (isMedical) {
      await ensureSheetExists(token, spreadsheetId, sheetName, MEDICAL_HEADERS);
    }
    await appendRow(token, spreadsheetId, sheetName, row);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("CRM error:", err.message);
    // Never fail the user flow for CRM issues
    return res.status(200).json({ ok: true, crmError: true });
  }
}
