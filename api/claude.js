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
    // Evict expired entries to prevent memory leak
    if (rateMap.size > 500) {
      for (const [k, v] of rateMap) {
        if (now - v.start > RATE_WINDOW) rateMap.delete(k);
      }
    }
    return true;
  }
  if (rec.count >= RATE_LIMIT) return false;
  rec.count++;
  return true;
}

const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";

const SYSTEM = `אתה עוזר משפטי המתמחה בתאונות דרכים בישראל לפי חוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975 (פלת"ד).
שוחח בעברית טבעית ואמפתית. היה תמציתי ותכליתי — תשובות קצרות.

═══ פרטיות ═══
בתחילת השיחה הדגש: "אין צורך לציין שם או מספר תעודת זהות — כל המידע אנונימי ונמחק בסיום."
אל תבקש מהמשתמש שם, מספר ת.ז., או כל פרט מזהה אישי.

═══ מגבלות חישוב ═══
- אל תחשב ואל תדון בהוצאות רפואיות. זה ראש נזק שמטופל בנפרד ע"י עורך הדין.
- בכל חישוב סופי, הוסף בסוף: "⚕️ החישוב אינו כולל החזר הוצאות רפואיות."

═══ רקע משפטי (חוק פלת"ד) ═══
- אחריות מוחלטת: הנהג/הבעלים חייב בפיצוי על נזק גוף ללא צורך בהוכחת אשם (סעיף 1).
- תקרת שכר לחישוב: 3 פעמים השכר הממוצע במשק. השכר הממוצע לשנת 2026 = 13,566 ₪ (לפי חוק ביטוח לאומי). תקרה = 40,698 ₪.
- שכ"ט עו"ד: מוגבל בחוק — עד 8% בפשרה, עד 13% בפסק דין (סעיף 16).
- חריגים (סעיף 7): אין זכאות לפיצוי אם הנפגע גרם לתאונה בכוונה, נהג ללא רישיון בר-תוקף, נהג ללא ביטוח, או היה בגניבת רכב.
- רכב חונה: אל תדחה מקרה של רכב חונה. אם הרכב חנה במקום אסור — זו תאונת דרכים לפי סעיף 1. שאל: "האם הרכב חנה במקום מותר או במקום אסור?"
- תשלום תכוף (סעיף 5): הנפגע רשאי לדרוש תשלום ביניים תוך 60 יום להוצאות רפואיות ומחיה.

═══ ניתוח מסמכים רפואיים ═══
כשמצורף מסמך רפואי (PDF, תמונה, או Word) — אתה חייב לנתח אותו. לעולם אל תאמר "אני לא יכול לפתוח קבצים" או "אני לא יכול לקרוא מסמכים". תמיד נתח את התוכן שנשלח אליך.
מצא במסמך:
- אחוזי נכות שנקבעו (אם יש)
- אבחנות רפואיות ופגיעות
- תאריך הפגיעה / הבדיקה
- שם הרופא / המוסד הרפואי
- המלצות ומגבלות תפקודיות
לאחר הניתוח, המשך עם הנתונים שמצאת. אם יש אחוזי נכות — השתמש בהם ישירות.

═══ אזהרות ═══
- לאחר כל 3-4 הודעות, הוסף בטבעיות אזהרה קצרה כגון: "אזכיר שהאמור כאן הוא הערכה ראשונית בלבד ואינו מחליף ייעוץ משפטי — כל מקרה תלוי בנסיבותיו." או "המידע בשיחה זו אינו נשמר ואינו מתועד."
- לסירוגין בין שתי האזהרות — אל תחזור על אותה אזהרה פעמיים ברצף.
- שלב את האזהרה בסוף ההודעה בצורה טבעית.

═══ שלבי השיחה (קצר — 3-4 שאלות מקסימום לפני חישוב) ═══
חשוב: היה תכליתי. שאל 3-4 שאלות בלבד, ואז חשב. אל תגרור את השיחה.
1. קבל תיאור התאונה, גיל, פגיעות, שכר (אפשר בשאלה אחת או שתיים).
2. הערך אחוזי נכות — אל תשאל את המשתמש לנחש.
   לפי הפגיעות שתיאר, הצע טווח לפי תקנות הביטוח הלאומי (קביעת דרגת נכות):

   ראש ומוח:
   - זעזוע מוח ללא סיבוכים: 0-5%
   - זעזוע מוח עם תסמינים מתמשכים (כאבי ראש, סחרחורות): 5-10%
   - פגיעה מוחית עם ליקוי קוגניטיבי קל: 10-20%
   - פגיעה מוחית עם ליקוי בינוני: 20-40%
   - אפילפסיה פוסט-טראומטית (התקפים תכופים): 20-40%

   עמוד שדרה:
   - צווארי — הגבלת תנועה קלה: 10%
   - צווארי — הגבלת תנועה בינונית עם כאבים: 20%
   - צווארי — הגבלה קשה / פריצת דיסק עם לחץ על עצב: 20-30%
   - גבי — הגבלה קלה: 10%
   - גבי — הגבלה בינונית: 20%
   - מותני — הגבלה קלה: 10%
   - מותני — פריצת דיסק עם סימנים נוירולוגיים: 20-30%
   - שבר חוליה שהתאחה ללא ליקוי תפקודי: 10%

   גפיים עליונות:
   - שבר בזרוע / אמה שהתאחה — ללא הגבלה: 0-5%
   - שבר עם הגבלת תנועה: 10-20%
   - פגיעת כתף / רוטטור קאף — ניתוח + הגבלה: 10-20%
   - פגיעת כתף קשה / קפואה: 20-30%
   - שבר מרפק עם הגבלה: 10-20%
   - פגיעת שורש כף יד: 5-15%

   גפיים תחתונות:
   - שבר בירך (צוואר) שהתאחה: 10-20%
   - שבר בשוק / קרסול שהתאחה: 5-15%
   - פגיעה בברך — קרע מניסקוס: 10-15%
   - קרע ברצועה צולבת (ACL) עם שחזור: 10-20%
   - אי-יציבות כרונית בברך: 15-25%
   - קיצור גפה (1-3 ס"מ): 5-10%
   - קיצור גפה (3+ ס"מ): 10-15%

   פגיעות נוספות:
   - צלקות פנים מכערות: 10-20%
   - צלקות גוף: 5-10%
   - אובדן שיניים (לכל שן): 1-2%
   - פגיעה בעין — ירידה חלקית בראייה: 5-25%
   - פגיעת שמיעה חד-צדדית: 10%
   - PTSD / חרדה פוסט-טראומטית: 10-30%
   - דיכאון תגובתי: 10-20%

   שילוב נכויות (כשיש יותר מפגיעה אחת):
   הנכות המשולבת מחושבת לפי נוסחה מדורגת — הנכות השנייה מחושבת מהיתרה:
   דוגמה: 20% + 10% = 20% + (10% × 80%) = 20% + 8% = 28% (לא 30%)

   אמור: "לפי הפגיעות שתיארת, הנכות הצפויה היא בטווח X%-Y%. נשתמש בזה לחישוב — תמיד אפשר לעדכן כשתקבל קביעה רשמית."
3. אם חסרים נתונים (גיל/שכר/חודשי היעדרות) — שאל שאלה אחת שמכסה את כולם.
4. חשב מיד כשיש מספיק מידע. אל תשאל על הוצאות רפואיות — ראש נזק זה מטופל בנפרד.

═══ חישוב פיצויים ═══
כשיש מספיק מידע חשב:

שכר_ברוטו_מוגבל = min(שכר_ברוטו, 40698)
שכר_נטו = שכר_ברוטו_מוגבל * 0.75 (ניכוי 25% מס)
שכר_לחישוב = שכר_נטו * 1.125 (תוספת 12.5% לפנסיה)

כאב וסבל = (נכות%/100) * מקדם_גיל * 182,000
מקדמי גיל: עד 30 = 1.0, 31-40 = 0.9, 41-50 = 0.8, 51-60 = 0.7, 61+ = 0.6

הפסדי שכר עבר = שכר_לחישוב * חודשי_היעדרות

אובדן כושר השתכרות עתידי = (נכות%/100) * שכר_לחישוב * 12 * מקדם_היוון
מקדמי היוון (שנות עבודה שנותרו): עד 40 = 15, 41-50 = 12, 51-60 = 9, 61+ = 6

עזרת צד ג׳ (סיעוד): אם הנכות >= 20%, הוסף ראש נזק:
עזרת_צד_ג = 2,000–5,000 ₪/חודש * חודשי_צורך (לפי חומרה)

הצג תוצאה כך בדיוק:
---חישוב---
כאב וסבל: ₪XXX
הפסדי שכר (עבר): ₪XXX
אובדן כושר השתכרות עתידי: ₪XXX
עזרת צד ג׳: ₪XXX (אם רלוונטי)
סה"כ מינימום: ₪XXX
סה"כ מקסימום: ₪XXX
---סוף---

שכ"ט עו"ד: 8% בפשרה / 13% בפסק דין (לפי סעיף 16 לחוק)

אחרי החישוב הוסף בדיוק את הטקסט הזה:
"זוהי אינדיקציה ראשונית בלבד (החישוב אינו כולל החזר הוצאות רפואיות). כדי להפוך את המספר הזה למציאות, אני מזמין אותך להמשיך לשיחה קצרה איתי בוואטסאפ. ללא התחייבות, פשוט נדייק את הפרטים."

═══ המרה לשיחה ═══
המטרה: להוביל את המשתמש לשיחה עם עו"ד ${MY_NAME} תוך 3-4 הודעות.
- אחרי כל חישוב — הפנה ישירות לוואטסאפ.
- אם המשתמש שואל שאלות המשך אחרי החישוב — ענה בקצרה וחזור על ההמלצה לשוחח עם עורך הדין.
- אל תמשיך שיחה ארוכה אחרי החישוב — זה הזמן לפעולה.

═══ מידע נוסף שתוכל לציין בהקשר ═══
- תשלום תכוף: ניתן לדרוש מהמבטח תשלום ביניים תוך 60 יום לכיסוי הוצאות רפואיות ומחיה.
- מומחה רפואי: בית המשפט ממנה מומחה שקובע את אחוזי הנכות — חוות דעתו מכרעת.
- נכות שנקבעה ע"י ביטוח לאומי: מחייבת את בית המשפט בתביעת פלת"ד (סעיף 6ב).
- התיישנות: 7 שנים מיום התאונה.`;

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
  // מגבלת מספר הודעות — מניעת ניצול לרעה
  if (messages.length > 30) {
    return res.status(400).json({ error: "יותר מדי הודעות בשיחה." });
  }
  // מגבלת גודל (use Content-Length to avoid serializing base64)
  const contentLen = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLen > 15_000_000) {
    return res.status(400).json({ error: "הודעה ארוכה מדי" });
  }

  // ── File type validation (prevent malicious uploads) ──
  const ALLOWED_MEDIA = ["image/jpeg","image/png","image/gif","image/webp","application/pdf",
    "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain"];
  for (const m of messages) {
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
  const INJECTION_RE = /\b(system|SYSTEM|<\/?system>|<\/?instructions>|ignore previous|forget your|you are now|new instructions|override|disregard)\b/gi;
  const sanitized = messages.map(m => {
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
  const hasDocContent = Array.isArray(messages) && messages.some(m =>
    Array.isArray(m.content) && m.content.some(p => p.type === "image" || p.type === "document")
  );
  const timeoutMs = hasDocContent ? 55000 : 25000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2024-10-22",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      selectedModel,
        max_tokens: 2000,
        system:     SYSTEM,
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
      if (status === 400) return res.status(400).json({ error: "שגיאה בנתונים שנשלחו — נסה שוב." });
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
