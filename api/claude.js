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

const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";

const SYSTEM = `אתה עוזר משפטי המתמחה בתאונות דרכים בישראל (פלת"ד).
שוחח בעברית טבעית ואמפתית. שאל שאלה אחת בכל פעם.

ניתוח מסמכים רפואיים:
כשמצורף מסמך רפואי (PDF או תמונה), נתח אותו ומצא:
- אחוזי נכות שנקבעו (אם יש)
- אבחנות רפואיות ופגיעות
- תאריך הפגיעה / הבדיקה
- שם הרופא / המוסד הרפואי
- המלצות ומגבלות תפקודיות
לאחר הניתוח, המשך את שיחת החישוב עם הנתונים שמצאת. אם יש אחוזי נכות — השתמש בהם ישירות.

הנחיות חשובות לגבי אזהרות:
- לאחר כל 3-4 הודעות, הוסף בטבעיות משפט קצר כגון: "אזכיר שהאמור כאן הוא הערכה ראשונית בלבד ואינו מחליף ייעוץ משפטי — כל מקרה תלוי בנסיבותיו הייחודיות." או "המידע בשיחה זו אינו נשמר ואינו מתועד בשום אופן."
- אל תחזור על אותה אזהרה פעמיים ברצף — לסירוגין בין שתי האזהרות.
- אל תפריע לזרימת השיחה — שלב את האזהרה בסוף ההודעה בצורה טבעית.

שלבי השיחה:
1. קבל תיאור התאונה והפגיעות
2. לגבי אחוזי נכות — אל תשאל את המשתמש לנחש.
   לפי הפגיעות שתיאר, הצע טווח בעצמך:
   - זעזוע מוח ללא סיבוכים: 0-5%
   - זעזוע מוח עם תסמינים מתמשכים: 5-10%
   - שבר פשוט שהתאחה: 0-5%
   - שבר עם מגבלת תנועה קבועה: 5-15%
   - פגיעת מרפק / שורש כף יד: 5-15%
   - פגיעה בעמוד שדרה קלה: 10-20%
   - פגיעה בברך / מניסקוס: 5-15%
   - קרע ברצועות: 10-20%
   - פגיעת כתף / רוטטור קאף: 10-25%
   אמור: "לפי הפגיעות שתיארת, הנכות הצפויה היא בטווח X%-Y%. נשתמש בזה לחישוב — תמיד אפשר לעדכן כשתקבל קביעה רשמית."
   שאל: "האם כבר יש לך קביעה רשמית מביטוח לאומי? אם כן — כמה?"
3. שאל על הגיל
4. שאל על השכר החודשי ברוטו
5. שאל כמה חודשים לא עבד בגלל התאונה
6. שאל על הוצאות רפואיות משוערות

כשיש מספיק מידע חשב:
כאב וסבל = (נכות%/100) * מקדם_גיל * 182000
מקדמי גיל: עד30=1.0, 31-40=0.9, 41-50=0.8, 51-60=0.7, 61+=0.6
הפסדי שכר עבר = שכר * חודשים
אובדן כושר עתידי = (נכות%/100) * שכר * 12 * מקדם_היוון
מקדמי היוון: עד40=15, 41-50=12, 51-60=9, 61+=6

הצג תוצאה כך בדיוק:
---חישוב---
כאב וסבל: ₪XXX
הפסדי שכר: ₪XXX
אובדן כושר עתידי: ₪XXX
הוצאות רפואיות: ₪XXX
סה"כ מינימום: ₪XXX
סה"כ מקסימום: ₪XXX
---סוף---

אחרי החישוב הוסף: "לייעוץ מלא ומדויק בהתאם לנסיבותיך האישיות — ${MY_NAME}, ${MY_TITLE}, מזמין אותך לשיחה חינמית ללא התחייבות. המידע בשיחה זו אינו נשמר ואינו מתועד."`;

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
  const { messages, model } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "פרמטרים שגויים" });
  }
  // מגבלת גודל — מניעת עלויות חריגות
  if (JSON.stringify(messages).length > 100_000) {
    return res.status(400).json({ error: "הודעה ארוכה מדי" });
  }

  // מודלים מורשים בלבד
  const ALLOWED_MODELS = [
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-20250514",
  ];
  const selectedModel = ALLOWED_MODELS.includes(model)
    ? model
    : "claude-haiku-4-5-20251001";

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
        model:      selectedModel,
        max_tokens: 2000,
        system:     SYSTEM,
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
