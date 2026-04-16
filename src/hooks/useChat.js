import { useState, useRef, useEffect } from "react";
import { sendToCrm } from "../utils/crm.js";

const WA = "972544338212";

// ═══ State Machine: Nifgati Bot ═══
const STATE_DISCLAIMER = 0;
const STATE_ROLE = 1;
const STATE_MEDICAL = 2;
const STATE_CONTEXT = 3;
const STATE_LOCATION = 4;
const STATE_INJURY = 5;
const STATE_DISABILITY = 6;
const STATE_MONTHS_OFF = 7;
const STATE_AGE = 8;
const STATE_SALARY = 9;
const STATE_DONE = 10;

const LOCATION_EXAMPLES = ["ברך", "כתף", "צוואר", "גב תחתון", "ראש", "יד", "קרסול", "צלעות", "בטן", "ירך", "מרפק", "אגן"];

function getLocationQuestion(g) {
  const shuffled = [...LOCATION_EXAMPLES].sort(() => Math.random() - 0.5);
  if (g === "female") return `היכן נפגעת?\nלדוגמה: ${shuffled[0]}, ${shuffled[1]} — או כל מקום אחר.`;
  if (g === "male") return `היכן נפגעת?\nלדוגמה: ${shuffled[0]}, ${shuffled[1]} — או כל מקום אחר.`;
  return `היכן נפגעת?\nלדוגמה: ${shuffled[0]}, ${shuffled[1]} — או כל מקום אחר.`;
}

const DRIVER_RE = /נהג|נהגת|הנהג/i;
const PASSENGER_RE = /נוסע|נוסעת|יושב/i;
const PEDESTRIAN_RE = /הולך|הולכת|רגל|חצ/i;
const MOTORCYCLE_RE = /אופנוע/i;
const SCOOTER_RE = /קורקינט|אופניים חשמליים/i;
const CAR_RE = /תאונת רכב|ברכב/i;
const WORK_ACCIDENT_RE = /תאונת עבודה|בעבודה/i;
const QUICK_REPLY_PREFIX_RE = /סוג התאונה שלי:/;

function getMedicalQuestion(g) {
  if (g === "female") return "האם פנית למיון או לבית חולים?";
  if (g === "male") return "האם פנית למיון או לבית חולים?";
  return "האם פנית למיון או לבית חולים?";
}
const YES_RE = /כן|בטח|פונ|מיון|בית.?חולים|אמבולנס|ניתוח|אשפוז/i;
const NO_RE = /לא|אף|בלי/i;

const CONTEXT_QUESTION = "התאונה קרתה בדרך לעבודה, בחזרה ממנה, או בשעות פנויות?";
const WORK_RE = /עבודה|בדרך ל|בחזרה מ|עובד|נסיעה לעבודה|משמרת/i;

const INJURY_QUESTION = "מה סוג הפגיעה?\nלמשל: צליפת שוט, שבר, פריצת דיסק, PTSD, פגיעה רכה — או תאר במילים שלך.";
const DISABILITY_QUESTION = "האם נקבעו לך אחוזי נכות?";
function getMonthsOffQuestion(g) {
  if (g === "female") return "כמה ימים לא עבדת (או צפוי שלא תעבדי) בגלל התאונה?";
  return "כמה ימים לא עבדת (או צפוי שלא תעבוד) בגלל התאונה?";
}
function getAgeQuestion(g) {
  if (g === "female") return "בת כמה את?";
  if (g === "male") return "בן כמה אתה?";
  return "בן/בת כמה אתה/את?";
}

// ── Injury → estimated disability mapping ──
function estimateDisability(injuryText) {
  const t = (injuryText || "").toLowerCase();
  if (/פריצת דיסק|דיסק|עמוד שדרה/.test(t)) return 15;
  if (/שבר מרוסק|שבר מורכב|שברים/.test(t)) return 15;
  if (/שבר/.test(t)) return 10;
  if (/ptsd|נפשי|טראומ|חרדה|דיכאון/.test(t)) return 15;
  if (/חבלת ראש|ראש|מוח/.test(t)) return 20;
  if (/צליפת שוט|צוואר|whiplash/.test(t)) return 5;
  if (/קרע|רצועה|מניסקוס|ברך/.test(t)) return 10;
  if (/כתף|ירך|אגן/.test(t)) return 10;
  if (/פגיעה רכה|חבורות|שריטות/.test(t)) return 5;
  return 10; // default
}

// ── Extract salary from user messages ──
function extractSalary(msgs) {
  const salaryMsg = (msgs || [])
    .filter(m => m.role === "user")
    .reverse()
    .find(m => /שכר|מרוויח|משתכר|שקל בחודש/.test(m.content));
  if (!salaryMsg) return 13566; // default: avg salary 2026
  const c = salaryMsg.content;
  if (c.includes("10,000 ל-20,000") || c.includes("10,000") && c.includes("20,000")) return 15000;
  if (c.includes("20,000 ל-30,000") || c.includes("20,000") && c.includes("30,000")) return 25000;
  if (c.includes("30,000 ל-50,000") || c.includes("30,000") && c.includes("50,000")) return 40000;
  if (c.includes("מעל 50,000") || c.includes("מעל")) return 55000;
  if (c.includes("עד 10,000")) return 8000;
  if (c.includes("לא עובד") || c.includes("לא רלוונטי")) return 0;
  const numMatch = c.match(/(\d[\d,]*)/);
  if (numMatch) return parseInt(numMatch[1].replace(/,/g, "")) || 13566;
  return 13566;
}

// ── Paltad-based calculation ──
function calculateCompensation(data, msgs) {
  const ageNum = parseInt(data.age) || 30;
  const disability = data.disability || 10;
  const monthsOff = data.monthsOff || 3;
  const salary = extractSalary(msgs) || 13566;

  // Age factor: younger = higher multiplier (more years of suffering)
  const ageFactor = ageNum <= 25 ? 1.3 : ageNum <= 40 ? 1.1 : ageNum <= 55 ? 1.0 : 0.85;

  // Pain & suffering (paltad formula base)
  const painSuffering = (disability / 100) * ageFactor * 182000;

  // Lost wages
  const lostWages = salary * monthsOff;

  // Work capacity loss for significant disability
  const futureCapacity = disability >= 10 ? (disability / 100) * salary * 12 * 3 : 0;

  // Medical expenses estimate
  const medicalExpenses = disability >= 10 ? 15000 : 5000;

  const base = painSuffering + lostWages + futureCapacity + medicalExpenses;
  const min = Math.round(base * 0.7);
  const max = Math.round(base * 1.3);

  return { min, max };
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source'),
    term: params.get('utm_term'),
    content: params.get('utm_content'),
    page: window.location.pathname
  };
}

function buildCrmPayload(data, calc, whatsappClick) {
  const { source, page } = getUrlParams();
  const roleLabel = roleToLabel(data.role);
  return {
    name: data.name || "",
    phone: data.phone || "",
    accidentType: roleLabel,
    hospitalized: data.medical,
    workAccident: data.isWork,
    age: data.age || "",
    disability: data.disability,
    compensationRange: calc ? `₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}` : "",
    page,
    whatsappClick: !!whatsappClick,
    utmSource: source || "",
  };
}

function getPersonalizedOpening() {
  const { term, page } = getUrlParams();
  const t = (term || '').toLowerCase();
  const p = (page || '').toLowerCase();

  if (t.includes('צליפת שוט') || t.includes('צוואר'))
    return 'שלום 👋 חיפשת פיצוי על צליפת שוט — זה ראש נזק מוכר ומוכח. ספר לי מה קרה ואחשב כמה מגיע לך.';
  if (t.includes('דרך לעבודה') || t.includes('תאונת עבודה'))
    return 'שלום 👋 נפגעת בתאונה? בוא נחשב כמה פיצוי מגיע לך לפי חוק הפלת״ד.';
  if (t.includes('נכות') || t.includes('אחוזי נכות'))
    return 'שלום 👋 חיפשת מה שווים אחוזי הנכות שלך — בוא נחשב בדיוק כמה כסף זה מייצג לפי החוק.';
  if (t.includes('כאב וסבל') || t.includes('כאב'))
    return 'שלום 👋 חיפשת מחשבון כאב וסבל — אתה במקום הנכון. כאב וסבל הוא רק חלק מהפיצוי המגיע לך. בוא נחשב את התמונה המלאה — כולל הפסדי שכר ונכות.';
  if (t.includes('מחשבון') || t.includes('חישוב') || t.includes('כמה'))
    return 'שלום 👋 בוא נחשב ישר — כמה שאלות קצרות ואתן לך הערכת פיצוי מיידית לפי חוק הפלת״ד. מה קרה לך?';

  if (p.includes('taonat-drakhim'))
    return 'שלום 👋 ראיתי שחיפשת עזרה בנושא תאונת דרכים. ספר לי מה קרה — ואחשב לך תוך דקות כמה פיצוי מגיע לך לפי החוק.';
  if (p.includes('machshevon'))
    return 'שלום 👋 בוא נחשב ישר — כמה שאלות קצרות ואתן לך הערכת פיצוי מיידית לפי חוק הפלת״ד. מה קרה לך?';
  if (p.includes('ofanoa'))
    return 'שלום 👋 תאונות אופנוע מזכות לרוב בפיצוי גבוה במיוחד. ספר לי מה קרה ואחשב כמה מגיע לך.';
  if (p.includes('avoda'))
    return 'שלום 👋 נפגעת בתאונת עבודה? בוא נחשב כמה פיצוי מגיע לך לפי החוק.';
  if (p.includes('korkinet'))
    return 'שלום 👋 נפגעת בתאונת קורקינט או אופניים חשמליים? החוק מגן עליך — ספר לי מה קרה.';
  if (p.includes('tzlipat-shot'))
    return 'שלום 👋 צליפת שוט מוכרת בחוק גם ללא שבר וגם ללא אחוזי נכות. ספר לי מה קרה בתאונה ואחשב כמה פיצוי מגיע לך.';
  if (p.includes('pritzat-disc'))
    return 'שלום 👋 פריצת דיסק בגלל תאונה מזכה בפיצוי משמעותי. ספר לי על הפגיעה ואחשב כמה מגיע לך.';
  if (p.includes('shever'))
    return 'שלום 👋 שבר בתאונה מזכה בפיצוי על כאב, היעדרות ונזק עתידי. בוא נחשב יחד.';
  if (p.includes('ptsd'))
    return 'שלום 👋 נזק נפשי אחרי תאונה הוא ראש נזק מוכר בחוק. בוא נבדוק כמה מגיע לך.';
  if (p.includes('holeh-regel'))
    return 'שלום 👋 הולכי רגל שנפגעו זכאים לפיצוי מלא — גם ללא אשם. ספר לי מה קרה.';
  if (p.includes('nechut'))
    return 'שלום 👋 כל אחוז נכות שווה עשרות אלפי שקלים. הכנס את הנתונים שלך ואחשב כמה מגיע לך.';

  return 'שלום 👋 נפגעת בתאונה? בוא נבדוק ב-60 שניות כמה פיצוי מגיע לך — חינם, ללא התחייבות.';
}

const DEFAULT_OPENING = "שלום, אני הבוט של ניפגעתי.\n\nאני מחשב הערכת פיצוי ראשונית המבוססת על:\nחוק פיצויים לנפגעי תאונות דרכים, תשל״ה-1975, תקנות הפיצויים לנפגעי תאונות דרכים (חישוב פיצויים בשל נזק שאינו נזק ממון), ופסיקת בתי המשפט.\n\nהאמור אינו מהווה יעוץ משפטי ואינו מחליף בירור מעמיק עם עו״ד דן אלון המותאם לנסיבותיך הספציפיות.";
const PERSONALIZED_SUFFIX = "";

function getInitialMsgs(customOpening) {
  const content = customOpening
    ? customOpening + PERSONALIZED_SUFFIX
    : DEFAULT_OPENING;
  return [
    { role: "assistant", content, privacy: true },
  ];
}

function classifyRole(txt) {
  if (SCOOTER_RE.test(txt)) return "scooter";
  if (MOTORCYCLE_RE.test(txt)) return "motorcycle";
  if (PEDESTRIAN_RE.test(txt)) return "pedestrian";
  if (WORK_ACCIDENT_RE.test(txt)) return "work";
  if (CAR_RE.test(txt)) return "car";
  if (DRIVER_RE.test(txt)) return "driver";
  if (PASSENGER_RE.test(txt)) return "passenger";
  if (QUICK_REPLY_PREFIX_RE.test(txt)) return "car"; // fallback for quick reply
  if (/נפגעתי|תאונה|תאונת דרכים/.test(txt)) return "car"; // general accident fallback
  return null;
}

function roleToLabel(role) {
  const map = { driver: "נהג", passenger: "נוסע", pedestrian: "הולך רגל", motorcycle: "רוכב אופנוע", scooter: "נפגע קורקינט/אופניים חשמליים", car: "נוסע/נהג ברכב", work: "תאונת עבודה" };
  return map[role] || "";
}

function roleResponse(role) {
  if (role === "driver") return "הבנתי. חברת הביטוח של הנהג האחר אחראית.";
  if (role === "passenger") return "הבנתי. אתה יכול לתבוע גם את חברת הביטוח של הנהג וגם של הרכב שלך.";
  if (role === "motorcycle") return "הבנתי. תאונות אופנוע מזכות לרוב בפיצוי גבוה במיוחד — חברת הביטוח של הרכב הפוגע אחראית לפצות אותך.";
  if (role === "scooter") return "הבנתי. גם נפגעי קורקינט זכאים לפיצוי — הכל תלוי בנסיבות התאונה.";
  if (role === "car") return "הבנתי. חברת הביטוח של הרכב המעורב אחראית לפצות אותך.";
  if (role === "work") return "הבנתי. תאונת עבודה — נבדוק את הזכויות שלך.";
  return "הבנתי. זה דורש הוכחה אבל יש לך זכויות.";
}

function medicalResponse(yes) {
  return yes
    ? "זה חשוב מאוד. הטיפול הרפואי הוא ראיה חזקה."
    : "הבנתי. גם ללא אשפוז יכול להיות לך קייס. יש לך כאבים או פגיעות?";
}

function contextResponse(isWork) {
  return isWork
    ? "תאונה בדרך לעבודה פותחת שני מסלולים נפרדים:\n\nפלת\"ד — מול חברת הביטוח של הרכב הפוגע:\n- פיצוי על כאב וסבל, אובדן שכר, הוצאות רפואיות\n- אחריות מוחלטת — לא צריך להוכיח אשם\n- תשלום בסוף ההליך (פשרה או פסק דין)\n\nביטוח לאומי — מוכר כתאונת עבודה:\n- גמלת נכות זמנית (דמי פגיעה) מהיום הראשון\n- קצבת נכות קבועה אם יש נכות צמיתה\n- מימון טיפולים רפואיים\n- חיסרון: הב\"ל מנכה חלק מהפיצוי שתקבל בפלת\"ד\n\nהמורכבות: שתי תביעות, שני לוחות זמנים, מסמכים שונים — וצריך לתאם ביניהן כדי שהב\"ל לא יקזז יותר מדי. עורך הדין מנהל את שניהם במקביל."
    : "מובן. במקרה זה הפיצוי הוא מחברת הביטוח לפי פלת״ד.";
}

function buildSummary(data, calc) {
  const { role, medical, isWork, location, age, injury, disability, monthsOff } = data;
  const ageNum = parseInt(age) || 30;
  const roleLabel = roleToLabel(role) || "לא צוין";
  const contextLabel = isWork ? "תאונה בדרך לעבודה (זכאות כפולה — ביטוח + ביטוח לאומי)" : "תאונה פרטית";
  const medLabel = medical ? "פנה למיון — ראיה רפואית חזקה" : "לא פנה למיון";
  const cleanInjury = (injury || "לא צוין").replace(/^סוג הפגיעה:\s*/i, "").replace(/\.$/, "");
  const locationLabel = location || "לא צוין";

  return `סיכום:\n• תפקיד: ${roleLabel}\n• ${medLabel}\n• ${contextLabel}\n• מיקום פגיעה: ${locationLabel}\n• סוג פגיעה: ${cleanInjury}\n• אחוזי נכות: ${disability}%\n• ימי היעדרות: ${monthsOff}\n• גיל: ${ageNum}\n\nהערכת פיצוי ראשונית: ₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}\n\nזוהי הערכה ראשונית בלבד לפי נוסחת הפלת״ד. לחץ על הכפתור למטה כדי לדבר עם עו"ד דן אלון בוואטסאפ ולקבל הערכה מדויקת.`;
}


const INITIAL_QUICK_REPLIES = [
  { label: "הבנתי, זה אינו יעוץ משפטי — המשך", value: "DISCLAIMER:accept" },
  { label: "אני מעוניין בייעוץ משפטי ישיר", value: "DISCLAIMER:whatsapp" },
];

const ACCIDENT_QUICK_REPLIES = [
  { label: "\u{1F697} רכב", value: "סוג התאונה שלי: תאונת רכב." },
  { label: "\u{1F3CD}\uFE0F אופנוע", value: "סוג התאונה שלי: תאונת אופנוע." },
  { label: "\u{1F6F4} קורקינט", value: "סוג התאונה שלי: תאונת קורקינט או אופניים חשמליים." },
  { label: "\u{1F6B6} הולך/ת רגל", value: "סוג התאונה שלי: נפגעתי כהולך רגל." },
  { label: "\u{1F3D7}\uFE0F תאונת עבודה", value: "סוג התאונה שלי: תאונת עבודה." },
];

const URGENCY_MSG = "\u{1F4A1} תיעוד מוקדם = פיצוי גבוה יותר. ככל שממתינים יותר, קשה יותר להוכיח — ורופאים, עדים ומסמכים הופכים לפחות זמינים.";

function getSocialProof(txt) {
  const t = (txt || "").toLowerCase();
  if (/פגיעה רכה|חבורות/.test(t))
    return "לקוחות שלנו עם פציעות רכות קיבלו לעיתים עשרות אלפי שקלים — תלוי בנסיבות. בוא נחשב את הסכום המדויק שלך.";
  if (/צליפת שוט|כאבי צוואר/.test(t))
    return "לקוחות שלנו עם צליפת שוט קיבלו בין \u20AA30,000 ל-\u20AA120,000 — תלוי בנכות ובנסיבות. בוא נחשב.";
  if (/פריצת דיסק|כאבי גב/.test(t))
    return "לקוחות שלנו עם פריצת דיסק קיבלו בין \u20AA60,000 ל-\u20AA400,000 — תלוי בחומרה. בוא נחשב.";
  if (/שבר/.test(t))
    return "לקוחות שלנו עם שברים קיבלו בין \u20AA30,000 ל-\u20AA250,000 — תלוי בסוג השבר ובנכות. בוא נחשב.";
  if (/חבלת ראש|ptsd|PTSD/.test(t))
    return "לקוחות שלנו עם חבלת ראש או PTSD קיבלו בין \u20AA100,000 ל-\u20AA500,000 — תלוי בחומרה. בוא נחשב.";
  if (/ברך|מפרק/.test(t))
    return "לקוחות שלנו עם פגיעות ברך קיבלו בין \u20AA50,000 ל-\u20AA300,000 — תלוי בנכות. בוא נחשב.";
  return "לקוחות שלנו עם פציעות דומות קיבלו בין \u20AA30,000 ל-\u20AA400,000 — תלוי בנסיבות. בוא נחשב את הסכום המדויק שלך.";
}

const NII_DISCLAIMER = "\n\n\u26A0\uFE0F אחוזים אלה לפי תקנות המל\"ל — משמשים כמדריך גם בתביעות פלת\"ד. הקביעה הסופית נעשית על ידי ועדה רפואית. זו הערכה ראשונית בלבד.";

const NII_ENTRIES = [
  { re: /צליפת שוט|whiplash/, label: "צליפת שוט", desc: "שהתרפאה — 0%. עם הגבלת תנועה שנותרה — 10%-20% בהתאם לחומרה. הפסיקה מכירה בה גם כשהדימות תקין" },
  { re: /פריצת דיסק|דיסק/, label: "פריצת דיסק", desc: "שהתרפאה — 0%. עם הפרעות נוירולוגיות — נכות לפי ממצא נוירולוגי והגבלת תנועה. ממצא MRI מחזק משמעותית את התיק" },
  { re: /עמוד שדרה מותני|גב תחתון|כאבי גב/, label: "עמוד שדרה מותני", desc: "הגבלת תנועה קלה — 10%. בינונית — 20%. קשה — 30%-40%. שבר חוליה שהתרפא ללא תזוזה — 5%-10%" },
  { re: /עמוד שדרה צווארי|כאבי צוואר/, label: "עמוד שדרה צווארי", desc: "הגבלה קלה — 10%. בינונית — 20%. קשה — 30%. שבר חוליה צווארית — 10%-40% לפי חומרה ותזוזה" },
  { re: /צלע|צלעות/, label: "פגיעת צלעות", desc: "שבר צלע שהתרפא — 0%. כריתת שתי צלעות — 10%. שלוש-ארבע — 20%. חמש-שש — 30%" },
  { re: /שבר/, label: "שבר", desc: "שהתרפא ללא תזוזה — 5%. עם תזוזה ניכרת — 10%-20%. שבר שלא התאחה — גבוה יותר לפי מיקום" },
  { re: /חבלת ראש|tbi|מוח|פגיעת ראש/, label: "חבלת ראש", desc: "קלה שהתרפאה — 0%-10%. עם תסמינים נוירולוגיים שנותרו — 20%-100%. בתי המשפט בוחנים בקפידה ממצאים אובייקטיביים" },
  { re: /ptsd/, label: "PTSD", desc: "קל — 10%-19%. בינוני — 20%-40%. קשה — 50%-100%. ההכרה ב-PTSD מתאונת דרכים שופרה משמעותית בפסיקה האחרונה" },
  { re: /דיכאון|חרדה|פסיכיאטר|נפשי/, label: "דיכאון / חרדה", desc: "קלה — 10%-19%. בינונית — 20%-40%. קשה המגבילה תפקוד — 50%-75%. דורש חוות דעת פסיכיאטרית" },
  { re: /ברך|מניסקוס|רצועה צולבת|acl/, label: "פגיעת ברך", desc: "הגבלת תנועה קלה — 10%. בינונית — 20%. קרע מניסקוס שנותח — 0%-10%. אי-יציבות שנותרת — 20%-30%" },
  { re: /כתף|רוטטור|סובבת/, label: "פגיעת כתף", desc: "הגבלת תנועה קלה — 10%. בינונית — 20%-30%. פגיעה מלאה בגיד הרוטטור — 30%-40% בהתאם לתפקוד שנותר" },
  { re: /יד|שורש כף|אצבע/, label: "פגיעת יד", desc: "הגבלת תנועה קלה — 10%-15%. אובדן תפקוד משמעותי — 20%-40%. שבר שלא התאחה בעצמות קטנות — 10%-20%" },
  { re: /רגל|קרסול|כף רגל/, label: "פגיעת רגל / קרסול", desc: "נקע שהתרפא — 0%. אי-יציבות כרונית — 10%-20%. שבר קרסול עם הגבלת תנועה — 10%-30%" },
  { re: /בטן|פנימי|טחול|כבד|כליה/, label: "חבלה פנימית", desc: "שהתרפאה ללא שאריות — 0%. עם כריתת איבר או פגיעה תפקודית — 20%-100% לפי הממצא" },
  { re: /פיברומיאלגיה|כאב כרוני/, label: "פיברומיאלגיה", desc: "הפרעה קלה בתפקוד — 10%. בינונית — 20%-30%. קשה הדורשת טיפול קבוע — 40%" },
  { re: /עין|ראייה/, label: "פגיעת עין", desc: "ירידה בחדות ראייה בעין אחת — 10%-30%. אובדן מלא של עין — 40%-60%" },
  { re: /אוזן|שמיעה|טנטון|טינטון/, label: "פגיעת אוזן / טנטון", desc: "אובדן שמיעה חלקי — 10%-40%. טנטון כרוני מתועד — 10%-20%" },
  { re: /פגיעה רכה|רקמות רכות|חבורות|שריטות/, label: "פגיעה רכה", desc: "שהתרפאה — 0%. עם כאב כרוני מתועד — ייתכן 10%. ללא ממצא אובייקטיבי, משקל נמוך לתלונות סובייקטיביות" },
];

function buildNiiResponse(txt) {
  const t = (txt || "").toLowerCase();
  const matched = NII_ENTRIES.filter(e => e.re.test(t));
  if (matched.length === 0) {
    return "לא מצאתי טווח ספציפי לפגיעה זו בתקנות. עו\"ד דן אלון יבחן את המסמכים הרפואיים ויעריך את הנכות הצפויה.";
  }
  const lines = matched.map(e => `- ${e.label} — ${e.desc}`);
  return "לפי תקנות המל\"ל:\n" + lines.join("\n") + NII_DISCLAIMER;
}

// Legacy single-match wrapper (kept for compatibility)
function getNiiGuidance(txt) {
  return buildNiiResponse(txt);
}

export default function useChat(customOpening) {
  const [msgs, setMsgs] = useState([...getInitialMsgs(customOpening)]);
  const [inp, setInp] = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(null);
  const [err, setErr] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [state, setState] = useState(STATE_DISCLAIMER);
  const [data, setData] = useState({ role: null, medical: null, isWork: null, location: null, injury: null, disability: null, monthsOff: null, age: null });
  const [quickReplies, setQuickReplies] = useState(INITIAL_QUICK_REPLIES);
  const [progress, setProgress] = useState(0);
  const [gender, setGender] = useState(null);
  const endRef = useRef(null);
  const hasInteracted = useRef(false);

  const shownUrgency = useRef(false);
  const shownSocialProof = useRef(false);
  const userMsgCount = useRef(0);
  const firedCalcComplete = useRef(false);
  const firedWhatsAppClick = useRef(false);

  useEffect(() => {
    if (!hasInteracted.current) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === "user") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 6000); return () => clearTimeout(t); }, [err]);

  // Detect bot questions and show contextual quick replies (check last 2 bot messages)
  useEffect(() => {
    const botMsgs = msgs.filter(m => m.role === "assistant");
    const lastBotMsg = botMsgs.slice(-1)[0];
    if (!lastBotMsg || quickReplies.length > 0) return;
    const content = lastBotMsg.content || "";
    const prevContent = (botMsgs.slice(-2, -1)[0] || {}).content || "";

    // Track which questions were already answered to prevent re-triggering
    const userMsgs = msgs.filter(m => m.role === "user");
    const hospitalAnswered = userMsgs.some(m => m.content.includes("פניתי למיון") || m.content.includes("לא פניתי"));
    const workAnswered = userMsgs.some(m => m.content.includes("בדרך לעבודה") || m.content.includes("שעות פנויות"));
    const disabilityAnswered = userMsgs.some(m => m.content.includes("נקבעו לי אחוזי נכות") || m.content.includes("אחוזי הנכות שלי:") || m.content.includes("בתהליך קביעת") || m.content.includes("נקבע לי 0%"));
    const ageAnswered = userMsgs.some(m => m.content.includes("הגיל שלי:"));
    const lastUserMsg = userMsgs.slice(-1)[0];

    function inEither(term) { return content.includes(term) || prevContent.includes(term); }
    function bothInEither(a, b) { return (content.includes(a) && content.includes(b)) || (prevContent.includes(a) && prevContent.includes(b)); }

    // Detect hospital question
    if (!hospitalAnswered && (inEither('מיון') || inEither('בית חולים') || inEither('פנית לטיפול') || inEither('טיפול רפואי'))) {
      setQuickReplies([
        { label: "כן, פניתי למיון / בית חולים", value: "כן, פניתי למיון או לבית חולים." },
        { label: "לא פניתי לטיפול רפואי", value: "לא, לא פניתי לטיפול רפואי." },
      ]);
      return;
    }

    // Detect work route question
    if (!workAnswered && (inEither('דרך לעבודה') || inEither('בחזרה ממנה') || inEither('שעות פנויות'))) {
      setQuickReplies([
        { label: "כן, בדרך לעבודה או חזרה", value: "התאונה קרתה בדרך לעבודה או בחזרה ממנה." },
        { label: "לא, בשעות פנויות", value: "התאונה קרתה בשעות פנויות, לא בדרך לעבודה." },
      ]);
      return;
    }

    // Detect disability question
    if (!disabilityAnswered && (inEither('אחוזי נכות') || (inEither('נכות') && (inEither('נקבעו') || inEither('קבעו'))))) {
      setQuickReplies([
        { label: "כן, נקבעו לי אחוזי נכות", value: "כן, נקבעו לי אחוזי נכות." },
        { label: "כן, נקבע 0%", value: "כן, נקבע לי 0% נכות." },
        { label: "לא נקבעו עדיין", value: "לא נקבעו לי אחוזי נכות עדיין." },
        { label: "בתהליך קביעה", value: "אני בתהליך קביעת אחוזי נכות." },
      ]);
      return;
    }

    // Detect user confirmed disability — show percentage buttons
    const pctAnswered = userMsgs.some(m => m.content.includes("אחוזי הנכות שלי:"));
    if (!pctAnswered && lastUserMsg && lastUserMsg.content.includes("נקבעו לי אחוזי נכות") && lastUserMsg.content.includes("כן")) {
      setQuickReplies([
        { label: "5%", value: "אחוזי הנכות שלי: 5%." },
        { label: "10%", value: "אחוזי הנכות שלי: 10%." },
        { label: "15%", value: "אחוזי הנכות שלי: 15%." },
        { label: "20%", value: "אחוזי הנכות שלי: 20%." },
        { label: "25%+", value: "אחוזי הנכות שלי: 25% ומעלה." },
        { label: "אחר", value: "OPEN_INPUT" },
      ]);
      return;
    }

    // Detect age question
    // Detect absence answer → show age buttons proactively
    if (!ageAnswered && lastUserMsg && /^\d+$/.test(lastUserMsg.content.trim()) && (inEither('ימים') || inEither('חודשים'))) {
      setQuickReplies([
        { label: "עד 25", value: "הגיל שלי: 22." },
        { label: "26\u201335", value: "הגיל שלי: 30." },
        { label: "36\u201345", value: "הגיל שלי: 40." },
        { label: "46\u201355", value: "הגיל שלי: 50." },
        { label: "56\u201365", value: "הגיל שלי: 60." },
        { label: "מעל 65", value: "הגיל שלי: 68." },
      ]);
      return;
    }

    // Detect age question
    if (!ageAnswered && (inEither('בן כמה') || inEither('בת כמה') || (inEither('גיל') && (inEither('בן') || inEither('בת') || inEither('כמה'))))) {
      setQuickReplies([
        { label: "עד 25", value: "הגיל שלי: 22." },
        { label: "26\u201335", value: "הגיל שלי: 30." },
        { label: "36\u201345", value: "הגיל שלי: 40." },
        { label: "46\u201355", value: "הגיל שלי: 50." },
        { label: "56\u201365", value: "הגיל שלי: 60." },
        { label: "מעל 65", value: "הגיל שלי: 68." },
      ]);
      return;
    }

    // Detect salary question
    const salaryAnswered = userMsgs.some(m => m.content.includes("שקל בחודש") || m.content.includes("לא עובד") || m.content.includes("לא רלוונטי"));
    if (!salaryAnswered && (/משתכר|שכר|הכנסה|מרוויח/.test(content) || /משתכר|שכר|הכנסה|מרוויח/.test(prevContent))) {
      setQuickReplies([
        { label: "עד \u20AA10,000", value: "אני מרוויח עד 10,000 שקל בחודש" },
        { label: "\u20AA10,000 – \u20AA20,000", value: "אני מרוויח בין 10,000 ל-20,000 שקל בחודש" },
        { label: "\u20AA20,000 – \u20AA30,000", value: "אני מרוויח בין 20,000 ל-30,000 שקל בחודש" },
        { label: "\u20AA30,000 – \u20AA50,000", value: "אני מרוויח בין 30,000 ל-50,000 שקל בחודש" },
        { label: "מעל \u20AA50,000", value: "אני מרוויח מעל 50,000 שקל בחודש" },
        { label: "לא עובד / לא רלוונטי", value: "אני לא עובד או שהשכר לא רלוונטי" },
      ]);
    }
  }, [msgs]);

  function restart() {
    setMsgs([...getInitialMsgs(customOpening)]);
    setCalc(null);
    setInp("");
    setErr("");
    setShowReferral(false);
    setState(STATE_DISCLAIMER);
    setData({ role: null, medical: null, isWork: null, location: null, injury: null, disability: null, monthsOff: null, age: null });
    // Allow events to fire again for a genuine new calculation
    firedCalcComplete.current = false;
    firedWhatsAppClick.current = false;
  }

  function trackStep(stepNumber, stepName) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "bot_step", step_number: stepNumber, step_name: stepName });
  }

  function handleQuickReply(value) {
    setQuickReplies([]);
    send(value);
  }

  function send(txt) {
    if (!txt.trim() || load) return;
    setQuickReplies([]); // Always clear immediately on any interaction

    // Handle disclaimer confirmation
    if (txt.trim().startsWith("DISCLAIMER:")) {
      const action = txt.trim().replace("DISCLAIMER:", "");
      setInp("");
      hasInteracted.current = true;
      if (action === "whatsapp") {
        setMsgs(prev => [...prev,
          { role: "user", content: "אני מעוניין בייעוץ משפטי ישיר" },
          { role: "assistant", content: "מעביר אותך לשיחה ישירה עם עו״ד דן אלון בוואטסאפ." },
        ]);
        setState(STATE_DONE);
        setTimeout(() => {
          window.location.href = `https://wa.me/${WA}?text=${encodeURIComponent("שלום דן, אני מעוניין בייעוץ משפטי בנושא תאונת דרכים.")}`;
        }, 500);
        return;
      }
      // action === "accept"
      setMsgs(prev => [...prev,
        { role: "user", content: "הבנתי, זה אינו יעוץ משפטי — המשך" },
        { role: "assistant", content: "נתחיל: איך היית מעורב/ת בתאונה?" },
      ]);
      setState(STATE_ROLE);
      setQuickReplies(ACCIDENT_QUICK_REPLIES);
      return;
    }

    // Block any free-text input before disclaimer is accepted
    if (state === STATE_DISCLAIMER) {
      setQuickReplies(INITIAL_QUICK_REPLIES);
      return;
    }

    // Handle gender selection — show in chat history
    if (txt.trim().startsWith("GENDER:")) {
      const g = txt.trim().replace("GENDER:", "");
      setGender(g);
      setInp("");
      hasInteracted.current = true;
      const genderLabel = g === "female" ? "\u{1F469} אני אישה" : "\u{1F468} אני גבר";
      const greeting = g === "female"
        ? "ספרי לי מה קרה — איזו תאונה עברת?"
        : "ספר לי מה קרה — איזו תאונה עברת?";
      setMsgs(prev => [...prev,
        { role: "user", content: genderLabel },
        { role: "assistant", content: greeting },
      ]);
      setQuickReplies(ACCIDENT_QUICK_REPLIES);
      return;
    }

    // Handle free input option — context-aware prompt
    if (txt.trim() === "OPEN_INPUT") {
      const openMsg = state === STATE_INJURY
        ? "ספר לי במילים שלך — מה הפגיעה?"
        : "ספר/י לי במילים שלך:";
      setMsgs(prev => [...prev, { role: "assistant", content: openMsg }]);
      return;
    }

    if (!hasInteracted.current) trackStep(1, "bot_opened");
    hasInteracted.current = true;
    userMsgCount.current++;
    setErr("");
    setInp("");

    const userMsg = { role: "user", content: txt };
    const botMsgs = [];
    const newData = { ...data };

    if (state === STATE_ROLE) {
      const role = classifyRole(txt);
      if (!role) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "לא הבנתי. היית הנהגת, נוסעת, הולכת רגל, או רוכבת אופנוע/קורקינט?" : "לא הבנתי. היית הנהג, נוסע, הולך רגל, או רוכב אופנוע/קורקינט?" });
      } else {
        newData.role = role;
        botMsgs.push({ role: "assistant", content: roleResponse(role) });
        botMsgs.push({ role: "assistant", content: getMedicalQuestion(gender) });
        setState(STATE_MEDICAL);
        setProgress(25);
        trackStep(2, "accident_type");
        // Show hospital yes/no quick replies
        setQuickReplies([
          { label: "כן, פניתי למיון / בית חולים", value: "כן, פניתי למיון או לבית חולים." },
          { label: "לא פניתי לטיפול רפואי", value: "לא, לא פניתי לטיפול רפואי." },
        ]);
      }
    } else if (state === STATE_MEDICAL) {
      const yes = YES_RE.test(txt);
      const no = NO_RE.test(txt);
      if (!yes && !no) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "פנית למיון או לבית חולים? כן או לא?" : "פנית למיון או לבית חולים? כן או לא?" });
      } else {
        newData.medical = yes;
        botMsgs.push({ role: "assistant", content: medicalResponse(yes) });
        botMsgs.push({ role: "assistant", content: CONTEXT_QUESTION });
        setState(STATE_CONTEXT);
        trackStep(3, "hospitalized");
      }
    } else if (state === STATE_CONTEXT) {
      const NOT_WORK_RE = /לא בדרך לעבודה|שעות פנויות|לא בעבודה|פרטי/i;
      const isWork = NOT_WORK_RE.test(txt) ? false : WORK_RE.test(txt);
      newData.isWork = isWork;
      botMsgs.push({ role: "assistant", content: contextResponse(isWork) });
      trackStep(4, "work_related");
      botMsgs.push({ role: "assistant", content: getLocationQuestion(gender) });
      setState(STATE_LOCATION);
    } else if (state === STATE_LOCATION) {
      newData.location = txt.trim();
      botMsgs.push({ role: "assistant", content: `הבנתי — נפגעת ב${txt.trim()}. אאסוף את כל הפגיעות יחד לחישוב.` });
      botMsgs.push({ role: "assistant", content: INJURY_QUESTION });
      setState(STATE_INJURY);
      setProgress(45);
    } else if (state === STATE_INJURY) {
      newData.injury = txt.trim();
      const cleanInjury = txt.trim().replace(/\.$/, "");
      botMsgs.push({ role: "assistant", content: `הבנתי — ${cleanInjury}. חשוב לתעד את זה.` });
      // NII disability guidance — supports multiple injuries in one response
      botMsgs.push({ role: "assistant", content: buildNiiResponse(txt) });
      // Social proof — show once based on injury type
      if (!shownSocialProof.current) {
        shownSocialProof.current = true;
        botMsgs.push({ role: "assistant", content: getSocialProof(txt) });
      }
      botMsgs.push({ role: "assistant", content: DISABILITY_QUESTION });
      setState(STATE_DISABILITY);
      setProgress(50);
    } else if (state === STATE_DISABILITY) {
      const zeroDisability = /נקבע.*0\s*%|0\s*%\s*נכות|אפס אחוז/.test(txt);
      const pctMatch = txt.match(/(\d+)\s*%?/);
      const dontKnow = /לא יודע|לא נקבע|אין|טרם|עדיין לא|בתהליך/.test(txt);
      if (zeroDisability || (pctMatch && parseInt(pctMatch[1]) === 0)) {
        newData.disability = 0;
        botMsgs.push({ role: "assistant", content: "0% נכות צמיתה עדיין מזכה בפיצוי על כאב וסבל לפי ימי האשפוז והטיפול.\nזה לא אומר שאין תביעה — זה אומר שהפיצוי מבוסס על רכיבים אחרים." });
      } else if (pctMatch) {
        newData.disability = Math.min(parseInt(pctMatch[1]), 100);
        botMsgs.push({ role: "assistant", content: `${newData.disability}% נכות — זה משמעותי מבחינת הפיצוי.` });
      } else if (dontKnow) {
        newData.disability = estimateDisability(newData.injury);
        botMsgs.push({ role: "assistant", content: `סטטיסטית, תיקים דומים מסתיימים בממוצע עם כ-${newData.disability}% נכות. אשתמש בזה לצורך ההערכה — עו״ד דן אלון יוכל לספק הערכה מדויקת יותר לאחר עיון במסמכים הרפואיים.` });
      } else {
        botMsgs.push({ role: "assistant", content: "כמה אחוזי נכות נקבעו לך? כתוב מספר, או ״לא יודע״." });
        setData(newData);
        setMsgs(p => [...p, userMsg, ...botMsgs]);
        return;
      }
      botMsgs.push({ role: "assistant", content: getMonthsOffQuestion(gender) });
      setState(STATE_MONTHS_OFF);
      setProgress(75);
      setQuickReplies([
        { label: "0 ימים", value: "0" },
        { label: "7 ימים", value: "7" },
        { label: "14 ימים", value: "14" },
        { label: "30 ימים", value: "30" },
        { label: "60 ימים", value: "60" },
        { label: "90+ ימים", value: "90" },
      ]);
    } else if (state === STATE_MONTHS_OFF) {
      const monthMatch = txt.match(/(\d+)/);
      if (!monthMatch) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "כמה ימים לא עבדת? כתבי מספר." : "כמה ימים לא עבדת? כתוב מספר." });
      } else {
        newData.monthsOff = parseInt(monthMatch[1]);
        botMsgs.push({ role: "assistant", content: `${newData.monthsOff} ימים — זה ייכלל בחישוב הפסדי השכר.` });
        botMsgs.push({ role: "assistant", content: getAgeQuestion(gender) });
        setState(STATE_AGE);
        trackStep(5, "age_asked");
      }
    } else if (state === STATE_AGE) {
      const ageMatch = txt.match(/(\d+)/);
      if (!ageMatch) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "בת כמה את? כתבי מספר." : "בן כמה אתה? כתוב מספר." });
      } else {
        newData.age = ageMatch[1];
        const salaryQ = gender === "female"
          ? "כמה את משתכרת בחודש? (משפיע ישירות על חישוב הפסד השכר)"
          : "כמה אתה משתכר בחודש? (משפיע ישירות על חישוב הפסד השכר)";
        botMsgs.push({ role: "assistant", content: salaryQ });
        setState(STATE_SALARY);
      }
    } else if (state === STATE_SALARY) {
      // Salary answered — now calculate
      const c = calculateCompensation(newData, [...msgs, userMsg]);
      botMsgs.push({ role: "assistant", content: "על בסיס הנתונים שלך:" });
      setCalc(c);
      setShowReferral(true);
      setState(STATE_DONE);
      setProgress(100);
      if (!firedCalcComplete.current) {
        firedCalcComplete.current = true;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "calculation_complete", value_min: c.min, value_max: c.max });
        console.log("[nifgati] calculation_complete fired", { min: c.min, max: c.max });
      }
      trackStep(6, "calculation_shown");
      trackStep(7, "cta_shown");
      // CRM: qualified lead (bot completed)
      sendToCrm(buildCrmPayload(newData, c, false));
    } else if (state === STATE_DONE) {
      botMsgs.push({ role: "assistant", content: "לחץ על הכפתור למטה כדי לשוחח עם עו\"ד דן אלון בוואטסאפ." });
    }

    // Urgency message — after 3+ messages without calc
    if (userMsgCount.current >= 5 && !calc && !shownUrgency.current && state !== STATE_DONE) {
      shownUrgency.current = true;
      botMsgs.push({ role: "assistant", content: URGENCY_MSG });
    }

    setData(newData);
    setMsgs(p => [...p, userMsg, ...botMsgs]);
  }

  // sendDoc — not used in state machine flow but kept for compatibility
  async function sendDoc() {
    setErr("בבוט זה אין צורך בצירוף מסמכים. ענה על השאלות ונעזור לך.");
  }

  function notifyWhatsApp() {
    const conversation = msgs.map(m => m.role === "user" ? `משתמש: ${m.content}` : `בוט: ${m.content}`);
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: "whatsapp_click",
        calculation: calc,
        conversation,
      }),
    }).catch(() => {});

    // CRM: WhatsApp clicked from bot
    sendToCrm(buildCrmPayload(data, calc, true));

    // GA4 whatsapp_click with lead details — fire only once per session
    if (!firedWhatsAppClick.current) {
      firedWhatsAppClick.current = true;
      const roleLabel = roleToLabel(data.role);
      const params = {
        event_category: "engagement",
        event_label: "whatsapp_button",
        accident_type: roleLabel || undefined,
        was_hospitalized: data.medical != null ? (data.medical ? "כן" : "לא") : undefined,
        compensation_estimate: calc ? `₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}` : undefined,
      };
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "whatsapp_click", ...params });
      console.log("[nifgati] whatsapp_click fired (bot)", params);
    }
  }

  // WhatsApp pre-filled message with all lead details
  const roleLabelMsg = roleToLabel(data.role);
  let waMsg = "שלום";
  if (data.role) {
    const lines = ["שלום דן, פנייה חדשה מהאתר:"];
    if (data.name) lines.push(`שם: ${data.name}`);
    lines.push(`סוג מעורבות: ${roleLabelMsg}`);
    if (data.medical != null) lines.push(`אשפוז: ${data.medical ? "כן" : "לא"}`);
    if (data.isWork != null) lines.push(`תאונת עבודה: ${data.isWork ? "כן" : "לא"}`);
    if (data.age) lines.push(`גיל: ${data.age}`);
    if (data.location) lines.push(`מיקום פגיעה: ${data.location}`);
    if (data.injury) lines.push(`סוג פגיעה: ${data.injury}`);
    if (data.disability != null) lines.push(`נכות: ${data.disability}%`);
    if (calc) lines.push(`הערכת פיצוי: ₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}`);
    lines.push("אשמח לבדיקה מעמיקה.");
    waMsg = lines.join("\n");
  }

  return {
    msgs, inp, setInp, load, setLoad, calc, err, setErr,
    showReferral, send, sendDoc, restart, waMsg, endRef, WA, notifyWhatsApp,
    quickReplies, handleQuickReply, progress, gender, data,
  };
}
