import { useState, useRef, useEffect } from "react";
import { sendToCrm } from "../utils/crm.js";

const WA = "972544338212";

// ═══ State Machine: Nifgati Bot — 14 Steps ═══
const STATE_DISCLAIMER = 0;
const STATE_STATUTE = 1;
const STATE_GENDER = 2;
const STATE_ROLE = 3;
const STATE_DATE = 4;
const STATE_MEDICAL = 5;
const STATE_DOCS = 6;
const STATE_CONTEXT = 7;
const STATE_LOCATION = 8;
const STATE_INJURY_LOOP = 9;
const STATE_FUNCTIONAL = 10;
const STATE_DISABILITY = 11;
const STATE_HOSPITALIZATION = 12;
const STATE_MONTHS_OFF = 13;
const STATE_AGE = 14;
const STATE_SALARY = 15;
const STATE_DONE = 16;
const STATE_PROGNOSIS = 17;
const STATE_NARRATIVE = 18;

// ── Questions ──
const LOCATION_QUESTION = "היכן נפגעת וממה אתה סובל?";
const FUNCTIONAL_QUESTION = "האם אתה סובל מקושי בביצוע פעולות יומיומיות — כגון לבישה, רחצה, הליכה, נהיגה, עבודה בית?";
const DISABILITY_QUESTION = "האם נקבעו לך אחוזי נכות?";
const CONTEXT_QUESTION = "התאונה קרתה בדרך לעבודה, בחזרה ממנה, או בשעות פנויות?";

// ── Smart extraction: body parts ──
const BODY_PARTS = [
  { re: /ברך|ברכיים/, label: "ברך" },
  { re: /כתף|כתפיים/, label: "כתף" },
  { re: /צוואר/, label: "צוואר" },
  { re: /גב תחתון|גב מותני|מותני/, label: "גב תחתון" },
  { re: /גב עליון|גב/, label: "גב" },
  { re: /ראש/, label: "ראש" },
  { re: /יד|כף יד|אצבע|אצבעות/, label: "יד" },
  { re: /קרסול/, label: "קרסול" },
  { re: /רגל|כף רגל/, label: "רגל" },
  { re: /צלע|צלעות/, label: "צלעות" },
  { re: /בטן/, label: "בטן" },
  { re: /ירך/, label: "ירך" },
  { re: /מרפק/, label: "מרפק" },
  { re: /אגן/, label: "אגן" },
  { re: /עין|עיניים/, label: "עין" },
  { re: /אוזן|אוזניים/, label: "אוזן" },
  { re: /פנים/, label: "פנים" },
  { re: /חזה/, label: "חזה" },
];

// ── Smart extraction: injury types ──
const INJURY_PATTERNS = [
  { re: /שבר|שברתי|נשבר/, label: "שבר" },
  { re: /צליפת שוט|whiplash/, label: "צליפת שוט" },
  { re: /פריצת דיסק|דיסק|בלט/, label: "פריצת דיסק" },
  { re: /קרע|נקרע/, label: "קרע" },
  { re: /נקע|נקעתי/, label: "נקע" },
  { re: /חבלה|חבלת/, label: "חבלה" },
  { re: /זעזוע/, label: "זעזוע מוח" },
  { re: /ptsd|PTSD/, label: "PTSD" },
  { re: /חרדה/, label: "חרדה" },
  { re: /דיכאון/, label: "דיכאון" },
  { re: /טראומה|טראומ/, label: "טראומה נפשית" },
];

function extractInjuryInfo(txt) {
  const t = txt.trim();
  const locations = [];
  const injuries = [];
  for (const bp of BODY_PARTS) { if (bp.re.test(t)) locations.push(bp.label); }
  for (const ip of INJURY_PATTERNS) { if (ip.re.test(t)) injuries.push(ip.label); }
  return { locations, injuries };
}

function buildNaturalEcho(txt, locations, injuries) {
  const t = txt.trim();
  if (/שברתי/.test(t) && locations.length > 0) return `הבנתי — שברת את ה${locations[0]}.`;
  if (/נקעתי/.test(t) && locations.length > 0) return `הבנתי — נקע ב${locations[0]}.`;
  if (/כואב לי|כאבים ב/.test(t) && locations.length > 0) return `הבנתי — כואב לך ב${locations[0]}.`;
  if (/נפגעתי ב/.test(t) && locations.length > 0) return `הבנתי — נפגעת ב${locations[0]}.`;
  if (injuries.length > 0 && locations.length > 0) return `הבנתי — ${injuries[0]} ב${locations[0]}.`;
  if (injuries.length > 0) return `הבנתי — ${injuries[0]}.`;
  if (locations.length > 0) return `הבנתי — נפגעת ב${locations[0]}.`;
  return `הבנתי — ${t}.`;
}

// ── Role classification ──
const DRIVER_RE = /נהג|נהגת|הנהג/i;
const PASSENGER_RE = /נוסע|נוסעת|יושב/i;
const PEDESTRIAN_RE = /הולך|הולכת|רגל|חצ/i;
const MOTORCYCLE_RE = /אופנוע/i;
const SCOOTER_RE = /קורקינט|אופניים חשמליים/i;
const CAR_RE = /תאונת רכב|ברכב/i;
const HIT_RUN_RE = /פגע וברח|פגע ברח/i;
const WORK_ACCIDENT_RE = /תאונת עבודה|בעבודה/i;
const QUICK_REPLY_PREFIX_RE = /סוג התאונה שלי:/;
const YES_RE = /כן|בטח|פונ|מיון|בית.?חולים|אמבולנס|ניתוח|אשפוז|טופלתי|אושפזתי|אמבולטורי/i;
const NO_RE = /לא|אף|בלי/i;
const WORK_RE = /עבודה|בדרך ל|בחזרה מ|עובד|נסיעה לעבודה|משמרת/i;

function classifyRole(txt) {
  if (HIT_RUN_RE.test(txt)) return "hitrun";
  if (SCOOTER_RE.test(txt)) return "scooter";
  if (MOTORCYCLE_RE.test(txt)) return "motorcycle";
  if (PEDESTRIAN_RE.test(txt)) return "pedestrian";
  if (WORK_ACCIDENT_RE.test(txt)) return "work";
  if (CAR_RE.test(txt)) return "car";
  if (DRIVER_RE.test(txt)) return "driver";
  if (PASSENGER_RE.test(txt)) return "passenger";
  if (QUICK_REPLY_PREFIX_RE.test(txt)) return "car";
  if (/נפגעתי|תאונה|תאונת דרכים/.test(txt)) return "car";
  return null;
}

function roleToLabel(role) {
  const map = { driver: "נהג", passenger: "נוסע", pedestrian: "הולך רגל", motorcycle: "רוכב אופנוע", scooter: "נפגע קורקינט/אופניים חשמליים", car: "נוסע/נהג ברכב", hitrun: "פגע וברח", work: "תאונת עבודה" };
  return map[role] || "";
}

function roleResponse(role) {
  if (role === "hitrun") return "תאונת פגע וברח מטופלת דרך קרן הפיצויים לנפגעי תאונות דרכים (קרנית) — גוף ממשלתי שמחליף את חברת הביטוח כשהנוהג אינו ידוע.\nהליך שונה אך הזכויות נשמרות. עו״ד דן אלון מטפל בתיקי קרנית.";
  if (role === "driver") return "הבנתי. חברת הביטוח של הנהג האחר אחראית.";
  if (role === "passenger") return "הבנתי. אתה יכול לתבוע גם את חברת הביטוח של הנהג וגם של הרכב שלך.";
  if (role === "motorcycle") return "הבנתי. תאונות אופנוע מזכות לרוב בפיצוי גבוה במיוחד — חברת הביטוח של הרכב הפוגע אחראית לפצות אותך.";
  if (role === "scooter") return "הבנתי. גם נפגעי קורקינט זכאים לפיצוי — הכל תלוי בנסיבות התאונה.";
  if (role === "car") return "הבנתי. חברת הביטוח של הרכב המעורב אחראית לפצות אותך.";
  if (role === "work") return "הבנתי. תאונת עבודה — נבדוק את הזכויות שלך.";
  return "הבנתי.";
}

function contextResponse(isWork) {
  return isWork
    ? "תאונה בדרך לעבודה פותחת שני מסלולים נפרדים:\n\nפלת\"ד — מול חברת הביטוח:\n- פיצוי על כאב וסבל, אובדן שכר, הוצאות רפואיות\n- אחריות מוחלטת — לא צריך להוכיח אשם\n\nביטוח לאומי — תאונת עבודה:\n- דמי פגיעה: 75% מהשכר לעד 13 שבועות — מהיום הראשון\n- קצבת נכות קבועה אם יש נכות צמיתה\n- חיסרון: הב\"ל מנכה חלק מפיצוי הפלת\"ד\n\n\u26A0\uFE0F הסכום המוצג בסוף הוא לפני ניכויי מל\"ל.\nשתי התביעות תנוהלנה במקביל כדי למקסם את הפיצוי הכולל."
    : "מובן. במקרה זה הפיצוי הוא מחברת הביטוח לפי פלת״ד.";
}

function getAgeQuestion(g) {
  if (g === "female") return "בת כמה את?";
  if (g === "male") return "בן כמה אתה?";
  return "בן/בת כמה אתה/את?";
}

function getMonthsOffQuestion(g) {
  if (g === "female") return "כמה ימים לא עבדת (או צפוי שלא תעבדי) בגלל התאונה?";
  return "כמה ימים לא עבדת (או צפוי שלא תעבוד) בגלל התאונה?";
}

// ── Extract salary from user messages ──
function extractSalary(msgs) {
  const salaryMsg = (msgs || []).filter(m => m.role === "user").reverse()
    .find(m => /שכר|מרוויח|משתכר|שקל בחודש/.test(m.content));
  if (!salaryMsg) return 13566;
  const c = salaryMsg.content;
  if (c.includes("10,000 ל-20,000") || (c.includes("10,000") && c.includes("20,000"))) return 15000;
  if (c.includes("20,000 ל-30,000") || (c.includes("20,000") && c.includes("30,000"))) return 25000;
  if (c.includes("30,000 ל-50,000") || (c.includes("30,000") && c.includes("50,000"))) return 40000;
  if (c.includes("מעל 50,000") || c.includes("מעל")) return 55000;
  if (c.includes("עד 10,000")) return 8000;
  if (c.includes("לא עובד") || c.includes("לא רלוונטי")) return 0;
  const numMatch = c.match(/(\d[\d,]*)/);
  if (numMatch) return parseInt(numMatch[1].replace(/,/g, "")) || 13566;
  return 13566;
}

// ── Severe-injury detection (for תרחיש ד) ──
function hasSevereInjury(data, msgs) {
  const parts = [
    ...(data.locations || []),
    ...Object.values(data.injuries || {}),
    data.injury || "",
    ...(msgs || []).filter(m => m.role === "user").map(m => m.content || ""),
  ];
  const text = parts.join(" ").toLowerCase();
  const severe = /קטיעה|קטועה|כריתה|אמפוטציה|amputation|שיתוק|משותק|פאראפלג|פרפלג|קוודריפלג|טטראפלג|paraplegia|quadriplegia|פגיעה מוחית קשה|פגיעת ראש קשה|נזק מוחי קשה|tbi\s*קשה|severe\s*tbi|חוסר הכרה ממושך|קומה\s|תרדמת|פוליטראומה|שברים מרובים|מרובי שברים|ריבוי שברים|שברים רבים|שברים מסובכים|שבר מסובך עם סיבוכים|אי איחוי|איחוי לקוי|זיהום כרוני/i;
  return severe.test(text);
}

// ── 4 Heads of Damage Calculation ──
function calculateCompensation(data, msgs, overrideDisability) {
  const ageNum = parseInt(data.age) || 30;
  const disability = overrideDisability != null ? overrideDisability : (data.disability != null ? data.disability : 0);
  const hospitalizationDays = data.hospitalizationDays != null ? data.hospitalizationDays : 0;
  const daysOff = data.monthsOff != null ? data.monthsOff : 0;
  const salary = extractSalary(msgs) || 13566;
  const dailySalary = salary / 22;
  const hasFunctional = !!data.functionalImpairment;

  // Age reduction: 1% per year over 30
  const ageReduction = Math.max(0, ageNum - 30) * 0.01;
  const ageFactor = Math.max(0.5, 1 - ageReduction);

  // 1. כאב וסבל (non-pecuniary)
  const painDisability = (disability / 100) * ageFactor * 182000;
  const painHospitalization = hospitalizationDays * 360;
  const painSuffering = painDisability + painHospitalization;

  // 2. הפסד שכר לעבר (past lost wages)
  const lostWages = daysOff * dailySalary;

  // 3. אובדן כושר השתכרות עתידי (future earning capacity loss)
  const monthsTo67 = Math.max(0, (67 - ageNum) * 12);
  const futureCapacity = disability > 0 ? salary * (disability / 100) * monthsTo67 * 0.7 : 0;

  // 4. עזרת צד ג׳ (third party assistance — if functional impairment)
  let thirdPartyHelp = 0;
  if (hasFunctional) {
    if (disability >= 20) thirdPartyHelp = 60000;
    else if (disability >= 10) thirdPartyHelp = 30000;
    else thirdPartyHelp = 15000;
  }

  const total = painSuffering + lostWages + futureCapacity + thirdPartyHelp;
  const min = Math.round(total * 0.85);
  const max = Math.round(total * 1.15);

  return { min, max };
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return { source: params.get('utm_source'), term: params.get('utm_term'), content: params.get('utm_content'), page: window.location.pathname };
}

function buildCrmPayload(data, calc, whatsappClick) {
  const { source, page } = getUrlParams();
  const hasInjury = !!(data.injury || (data.injuries && Object.keys(data.injuries).length));
  return {
    name: data.name || "", phone: data.phone || "",
    accidentType: roleToLabel(data.role), hospitalized: data.medical,
    workAccident: data.isWork, age: data.age || "", disability: data.disability,
    compensationRange: calc ? `₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}` : "",
    // Extra signals for lead scoring (internal)
    hasDocs: data.hasDocs, hospitalizationDays: data.hospitalizationDays,
    monthsOff: data.monthsOff, yearsSinceAccident: data.yearsSinceAccident,
    hasInjury, injury: data.injury || "",
    functionalImpairment: data.functionalImpairment,
    functionalPrognosis: data.functionalPrognosis,
    hitAndRun: !!data.hitAndRun, psychologicalSymptoms: !!data.psychologicalSymptoms,
    narrative: data.narrative || "",
    page, whatsappClick: !!whatsappClick, utmSource: source || "",
  };
}

// ── NII Injury Knowledge Base ──
const NII_DISCLAIMER = "\n\n\u26A0\uFE0F אחוזים אלה לפי תקנות המל\"ל — משמשים כמדריך גם בתביעות פלת\"ד. הקביעה הסופית נעשית על ידי ועדה רפואית. זו הערכה ראשונית בלבד.";

const NII_ENTRIES = [
  { re: /צליפת שוט|whiplash|נקע צווארי|נקע/, label: "נקע צווארי / צליפת שוט", desc: "התרפא — 0%. הגבלת תנועה שנותרה — 10%-20%" },
  { re: /פריצת דיסק|דיסק|בקע/, label: "פריצת דיסק", desc: "התרפאה — 0%. עם הפרעות נוירולוגיות — 10%-40%" },
  { re: /עמוד שדרה מותני|גב תחתון|כאבי גב/, label: "עמוד שדרה מותני", desc: "הגבלה קלה — 10%. בינונית — 20%. קשה — 30%-40%" },
  { re: /עמוד שדרה צווארי|כאבי צוואר/, label: "עמוד שדרה צווארי", desc: "הגבלה קלה — 10%. בינונית — 20%. קשה — 30%" },
  { re: /צלע|צלעות/, label: "פגיעת צלעות", desc: "שבר אחת — 0%. שתיים — 10%. שלוש-ארבע — 20%" },
  { re: /שבר/, label: "שבר", desc: "ללא תזוזה — 5%. עם תזוזה — 10%-20%. לא התאחה — 10%-30%" },
  { re: /חבלת ראש|tbi|מוח|פגיעת ראש|זעזוע/, label: "חבלת ראש", desc: "קלה — 0%-10%. עם תסמינים — 20%-40%. נוירולוגית — 20%-100%" },
  { re: /ptsd/, label: "PTSD", desc: "קל — 10%-19%. בינוני — 20%-40%. קשה — 50%-100%" },
  { re: /דיכאון|חרדה|פסיכיאטר|נפשי/, label: "דיכאון / חרדה", desc: "קלה — 10%-19%. בינונית — 20%-40%. קשה — 50%-75%" },
  { re: /ברך|מניסקוס|רצועה צולבת|acl/, label: "פגיעת ברך", desc: "קרע מניסקוס לאחר ניתוח — 0%-10%. קרע רצועה ACL — 10%-20%. אי-יציבות — 20%-30%" },
  { re: /כתף|רוטטור|סובבת/, label: "פגיעת כתף", desc: "הגבלה קלה — 10%. בינונית — 20%-30%. קרע גיד רוטטור מלא — 30%-40%" },
  { re: /יד|שורש כף|אצבע/, label: "פגיעת יד", desc: "הגבלה קלה — 10%-15%. אובדן תפקוד — 20%-40%" },
  { re: /רגל|קרסול|כף רגל/, label: "פגיעת רגל / קרסול", desc: "נקע — 0%. אי-יציבות כרונית — 10%-20%. שבר — 10%-30%" },
  { re: /בטן|פנימי|טחול|כבד|כליה/, label: "חבלה פנימית", desc: "התרפאה — 0%. כריתת איבר — 20%-100%" },
  { re: /פיברומיאלגיה|כאב כרוני/, label: "פיברומיאלגיה", desc: "קלה — 10%. בינונית — 20%-30%. קשה — 40%" },
  { re: /עין|ראייה/, label: "פגיעת עין", desc: "ירידת ראייה — 10%-30%. אובדן עין — 40%-60%" },
  { re: /אוזן|שמיעה|טנטון|טינטון/, label: "פגיעת אוזן / טנטון", desc: "אובדן שמיעה — 10%-40%. טנטון — 10%-20%" },
  { re: /פגיעה רכה|רקמות רכות|חבורות|שריטות/, label: "פגיעה רכה", desc: "התרפאה — 0%. כאב כרוני מתועד — ייתכן 10%" },
];

function buildNiiResponse(txt) {
  const t = (txt || "").toLowerCase();
  const matched = NII_ENTRIES.filter(e => e.re.test(t));
  if (matched.length === 0) return "לא מצאתי טווח ספציפי לפגיעה זו בתקנות. עו\"ד דן אלון יבחן את המסמכים הרפואיים ויעריך את הנכות הצפויה.";
  const lines = matched.map(e => `- ${e.label} — ${e.desc}`);
  return "לפי תקנות המל\"ל:\n" + lines.join("\n") + NII_DISCLAIMER;
}

// ── Opening + Disclaimer ──
const AI_DISCLOSURE = "הצ׳אט מופעל על ידי AI ומפוקח על ידי עו״ד אנושי.";
const DEFAULT_OPENING = "שלום, אני הבוט של ניפגעתי.\n" + AI_DISCLOSURE + "\n\nאני מחשב הערכת פיצוי ראשונית המבוססת על:\nחוק פיצויים לנפגעי תאונות דרכים, תשל״ה-1975, תקנות הפיצויים לנפגעי תאונות דרכים (חישוב פיצויים בשל נזק שאינו נזק ממון), ופסיקת בתי המשפט.\n\nהאמור אינו מהווה יעוץ משפטי ואינו מחליף בירור מעמיק עם עו״ד דן אלון המותאם לנסיבותיך הספציפיות.";
const PERSONALIZED_SUFFIX = "\n" + AI_DISCLOSURE;

function getInitialMsgs(customOpening) {
  const content = customOpening ? customOpening + PERSONALIZED_SUFFIX : DEFAULT_OPENING;
  return [{ role: "assistant", content, privacy: true }];
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
  { label: "\u{1F697}\u{1F4A8} פגע וברח", value: "סוג התאונה שלי: פגע וברח." },
];

// ── WhatsApp CTA variants ──
function getCtaVariant(data, calc) {
  const amount = calc ? `₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}` : "";
  const variants = [
    `שלח לי את הערכת הפיצוי (${amount}) לייעוץ — דן אלון, עו״ד`,
  ];
  if (data.accidentDate === "recent") {
    variants.push("התאונה קרתה לאחרונה, אני רוצה לשמור על הזכויות שלי");
  }
  return variants[Math.floor(Math.random() * variants.length)];
}

// ── Session / resume support ──
const RESUME_KEY_PREFIX = "nifgati_chat_";
const RESUME_SID_KEY = "nifgati_sid";

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const urlSid = params.get("resume");
  if (urlSid && /^[a-z0-9_-]{6,32}$/i.test(urlSid)) {
    sessionStorage.setItem(RESUME_SID_KEY, urlSid);
    return urlSid;
  }
  let sid = sessionStorage.getItem(RESUME_SID_KEY);
  if (!sid) {
    sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    sessionStorage.setItem(RESUME_SID_KEY, sid);
  }
  return sid;
}

function loadResumeState(sid) {
  if (!sid || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESUME_KEY_PREFIX + sid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.msgs)) return null;
    return parsed;
  } catch { return null; }
}

// ═══ Hook ═══
export default function useChat(customOpening) {
  const sessionIdRef = useRef(getOrCreateSessionId());
  const resumed = useRef(loadResumeState(sessionIdRef.current));

  const [msgs, setMsgs] = useState(resumed.current?.msgs || [...getInitialMsgs(customOpening)]);
  const [inp, setInp] = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(resumed.current?.calc || null);
  const [err, setErr] = useState("");
  const [showReferral, setShowReferral] = useState(resumed.current?.showReferral || false);
  const [state, setState] = useState(resumed.current?.state ?? STATE_DISCLAIMER);
  const [data, setData] = useState(resumed.current?.data || { role: null, medical: null, hasDocs: null, isWork: null, accidentDate: null, yearsSinceAccident: null, narrative: null, hitAndRun: false, psychologicalSymptoms: false, locations: [], injuries: {}, currentLocation: null, injury: null, functionalImpairment: null, functionalPrognosis: null, disability: null, disabilityScenario: null, hospitalizationDays: null, monthsOff: null, age: null });
  const [quickReplies, setQuickReplies] = useState(resumed.current?.quickReplies || INITIAL_QUICK_REPLIES);
  const [progress, setProgress] = useState(resumed.current?.progress || 0);
  const [gender, setGender] = useState(resumed.current?.gender || null);
  const endRef = useRef(null);
  const hasInteracted = useRef(false);
  const userMsgCount = useRef(0);
  const firedCalcComplete = useRef(false);
  const firedWhatsAppClick = useRef(false);

  useEffect(() => {
    if (!hasInteracted.current) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === "user") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 6000); return () => clearTimeout(t); }, [err]);

  // Persist snapshot for resume via ?resume=<sid>. sessionStorage only (per-tab).
  useEffect(() => {
    try {
      const snapshot = { msgs, data, state, progress, gender, calc, showReferral, quickReplies };
      sessionStorage.setItem(RESUME_KEY_PREFIX + sessionIdRef.current, JSON.stringify(snapshot));
    } catch { /* quota or serialization — ignore */ }
  }, [msgs, data, state, progress, gender, calc, showReferral, quickReplies]);

  // ── Contextual quick replies ──
  useEffect(() => {
    const botMsgs = msgs.filter(m => m.role === "assistant");
    const lastBotMsg = botMsgs.slice(-1)[0];
    if (!lastBotMsg || quickReplies.length > 0) return;
    const content = lastBotMsg.content || "";
    const prevContent = (botMsgs.slice(-2, -1)[0] || {}).content || "";
    const userMsgs = msgs.filter(m => m.role === "user");
    const ageAnswered = userMsgs.some(m => m.content.includes("הגיל שלי:"));

    function inEither(term) { return content.includes(term) || prevContent.includes(term); }

    // Detect disability question → show buttons
    const disabilityAnswered = userMsgs.some(m => m.content.includes("נקבעו לי אחוזי נכות") || m.content.includes("אחוזי הנכות שלי:") || m.content.includes("בתהליך קביעת") || m.content.includes("נקבע לי 0%"));
    if (!disabilityAnswered && (inEither('אחוזי נכות') || (inEither('נכות') && (inEither('נקבעו') || inEither('קבעו'))))) {
      setQuickReplies([
        { label: "כן, נקבעה נכות", value: "כן, נקבעו לי אחוזי נכות." },
        { label: "כן, נקבע 0%", value: "כן, נקבע לי 0% נכות." },
        { label: "טרם נקבעה נכות", value: "לא נקבעו לי אחוזי נכות עדיין." },
        { label: "לא נקבעה / אין תעודות", value: "אין לי תעודות רפואיות בנושא נכות." },
      ]);
      return;
    }

    // Detect user confirmed disability → show percentage buttons
    const pctAnswered = userMsgs.some(m => m.content.includes("אחוזי הנכות שלי:"));
    const lastUserMsg = userMsgs.slice(-1)[0];
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

    // Detect age question → show buttons
    if (!ageAnswered && (inEither('בן כמה') || inEither('בת כמה'))) {
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

    // Detect salary question — only at STATE_SALARY
    const salaryAnswered = userMsgs.some(m => m.content.includes("שקל בחודש") || m.content.includes("לא עובד") || m.content.includes("לא רלוונטי"));
    if (state === STATE_SALARY && !salaryAnswered && (/משתכר|שכר|הכנסה|מרוויח/.test(content) || /משתכר|שכר|הכנסה|מרוויח/.test(prevContent))) {
      setQuickReplies([
        { label: "עד \u20AA10,000", value: "אני מרוויח עד 10,000 שקל בחודש" },
        { label: "\u20AA10,000 – \u20AA20,000", value: "אני מרוויח בין 10,000 ל-20,000 שקל בחודש" },
        { label: "\u20AA20,000 – \u20AA30,000", value: "אני מרוויח בין 20,000 ל-30,000 שקל בחודש" },
        { label: "\u20AA30,000 – \u20AA50,000", value: "אני מרוויח בין 30,000 ל-50,000 שקל בחודש" },
        { label: "מעל \u20AA50,000", value: "אני מרוויח מעל 50,000 שקל בחודש" },
        { label: "לא עובד/ת", value: "אני לא עובד או שהשכר לא רלוונטי" },
      ]);
    }
  }, [msgs, state]);

  function restart() {
    try { sessionStorage.removeItem(RESUME_KEY_PREFIX + sessionIdRef.current); } catch {}
    setMsgs([...getInitialMsgs(customOpening)]);
    setCalc(null); setInp(""); setErr(""); setShowReferral(false);
    setState(STATE_DISCLAIMER);
    setData({ role: null, medical: null, hasDocs: null, isWork: null, accidentDate: null, yearsSinceAccident: null, narrative: null, hitAndRun: false, psychologicalSymptoms: false, locations: [], injuries: {}, currentLocation: null, injury: null, functionalImpairment: null, functionalPrognosis: null, disability: null, disabilityScenario: null, hospitalizationDays: null, monthsOff: null, age: null });
    firedCalcComplete.current = false;
    firedWhatsAppClick.current = false;
  }

  function trackStep(n, name) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "bot_step", step_number: n, step_name: name });
  }

  function handleQuickReply(value) { setQuickReplies([]); send(value); }

  function send(txt) {
    if (!txt.trim() || load) return;
    setQuickReplies([]);

    // ── DISCLAIMER ──
    if (txt.trim().startsWith("DISCLAIMER:")) {
      const action = txt.trim().replace("DISCLAIMER:", "");
      setInp(""); hasInteracted.current = true;
      if (action === "whatsapp") {
        setMsgs(prev => [...prev, { role: "user", content: "אני מעוניין בייעוץ משפטי ישיר" }, { role: "assistant", content: "מעביר אותך לשיחה ישירה עם עו״ד דן אלון בוואטסאפ." }]);
        setState(STATE_DONE);
        setTimeout(() => { window.location.href = `https://wa.me/${WA}?text=${encodeURIComponent("שלום דן, אני מעוניין בייעוץ משפטי בנושא תאונת דרכים.")}`; }, 500);
        return;
      }
      setMsgs(prev => [...prev, { role: "user", content: "הבנתי, זה אינו יעוץ משפטי — המשך" }, { role: "assistant", content: "נפגעת בתאונה ב-7 השנים האחרונות?" }]);
      setState(STATE_STATUTE);
      setProgress(5);
      setQuickReplies([{ label: "כן", value: "כן" }, { label: "לא", value: "לא" }]);
      return;
    }
    if (state === STATE_DISCLAIMER) { setQuickReplies(INITIAL_QUICK_REPLIES); return; }

    // ── OPEN_INPUT ──
    if (txt.trim() === "OPEN_INPUT") {
      setMsgs(prev => [...prev, { role: "assistant", content: state === STATE_INJURY_LOOP ? "ספר לי במילים שלך — מה הפגיעה?" : "ספר/י לי במילים שלך:" }]);
      return;
    }

    if (!hasInteracted.current) trackStep(0, "bot_opened");
    hasInteracted.current = true;
    userMsgCount.current++;
    setErr(""); setInp("");

    const userMsg = { role: "user", content: txt };
    const botMsgs = [];
    const newData = { ...data };

    // ═══ STEP 0: STATUTE OF LIMITATIONS ═══
    if (state === STATE_STATUTE) {
      if (NO_RE.test(txt) && !YES_RE.test(txt)) {
        botMsgs.push({ role: "assistant", content: "לצערי, חוק פלת\"ד קובע התיישנות של 7 שנים מיום התאונה.\nבמקרים מסוימים ניתן להאריך — עו\"ד דן אלון יוכל לבדוק אם קיימת עילה." });
        setShowReferral(true);
        setState(STATE_DONE);
      } else {
        botMsgs.push({ role: "assistant", content: "איך תרצה שאפנה אליך?" });
        setState(STATE_GENDER);
        setProgress(10);
        setQuickReplies([{ label: "פנה אליי בלשון זכר", value: "GENDER:male" }, { label: "פני אליי בלשון נקבה", value: "GENDER:female" }]);
      }

    // ═══ STEP 1: GENDER ═══
    } else if (state === STATE_GENDER) {
      if (txt.trim().startsWith("GENDER:")) {
        const g = txt.trim().replace("GENDER:", "");
        setGender(g);
        botMsgs.push({ role: "user", content: g === "female" ? "פני אליי בלשון נקבה" : "פנה אליי בלשון זכר" });
        botMsgs.push({ role: "assistant", content: g === "female" ? "ספרי לי מה קרה בתאונה? כתבי בחופשיות, ולאחר מכן אחדד עם מספר שאלות." : "ספר לי מה קרה בתאונה? כתוב בחופשיות, ולאחר מכן אחדד עם מספר שאלות." });
        setState(STATE_NARRATIVE);
        setProgress(14);
        setQuickReplies([]);
        setData(newData); setMsgs(p => [...p, ...botMsgs]); return;
      }
      // Fallback
      botMsgs.push({ role: "assistant", content: "בחר בבקשה:" });
      setQuickReplies([{ label: "פנה אליי בלשון זכר", value: "GENDER:male" }, { label: "פני אליי בלשון נקבה", value: "GENDER:female" }]);

    // ═══ STEP 1b: OPEN NARRATIVE ═══
    } else if (state === STATE_NARRATIVE) {
      newData.narrative = txt;
      // Auto-extract signals from narrative
      const extracted = extractInjuryInfo(txt);
      if (extracted.locations.length) {
        newData.locations = extracted.locations;
        if (extracted.injuries.length) {
          newData.injuries = {};
          extracted.locations.forEach(loc => { newData.injuries[loc] = extracted.injuries.join(" + "); });
          newData.injury = extracted.locations.map(loc => `${loc}: ${extracted.injuries.join(" + ")}`).join(", ");
        }
      }
      if (/בדרך לעבודה|בחזרה מעבודה|בדרך הביתה מעבודה/.test(txt)) newData.isWork = true;
      if (/פגע וברח|לא עצר|ברח מהזירה|פגע ונמלט/.test(txt)) newData.hitAndRun = true;
      if (/ptsd|פוסט[\s\-]?טראומ|חרדה|דיכאון|סיוטים|פלאשבק|התקפי בהלה/i.test(txt)) newData.psychologicalSymptoms = true;

      botMsgs.push({ role: "assistant", content: gender === "female" ? "תודה. אשאל עכשיו כמה שאלות ממוקדות כדי להשלים את ההערכה." : "תודה. אשאל עכשיו כמה שאלות ממוקדות כדי להשלים את ההערכה." });
      botMsgs.push({ role: "assistant", content: gender === "female" ? "במה היית מעורבת בתאונה?" : "במה היית מעורב בתאונה?" });
      setState(STATE_ROLE);
      setProgress(18);
      setQuickReplies(ACCIDENT_QUICK_REPLIES);

    // ═══ STEP 2: ACCIDENT TYPE ═══
    } else if (state === STATE_ROLE) {
      const role = classifyRole(txt);
      if (!role) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "לא הבנתי. היית הנהגת, נוסעת, הולכת רגל, או רוכבת אופנוע/קורקינט?" : "לא הבנתי. היית הנהג, נוסע, הולך רגל, או רוכב אופנוע/קורקינט?" });
      } else {
        newData.role = role;
        botMsgs.push({ role: "assistant", content: roleResponse(role) });
        botMsgs.push({ role: "assistant", content: "מתי קרתה התאונה?" });
        setState(STATE_DATE);
        setProgress(25);
        trackStep(2, "accident_type");
        setQuickReplies([
          { label: "השבוע", value: "התאונה קרתה השבוע." },
          { label: "בחודש האחרון", value: "התאונה קרתה בחודש האחרון." },
          { label: "בשנה האחרונה", value: "התאונה קרתה בשנה האחרונה." },
          { label: "לפני 1-3 שנים", value: "התאונה קרתה לפני 1-3 שנים." },
          { label: "לפני 3-5 שנים", value: "התאונה קרתה לפני 3-5 שנים." },
          { label: "לפני 5-7 שנים", value: "התאונה קרתה לפני 5-7 שנים." },
          { label: "יותר מ-7 שנים", value: "התאונה קרתה לפני יותר מ-7 שנים." },
        ]);
      }

    // ═══ STEP 3: ACCIDENT DATE ═══
    } else if (state === STATE_DATE) {
      const isRecent = /השבוע|בחודש האחרון/.test(txt);
      newData.accidentDate = isRecent ? "recent" : "past";
      // Extract approximate years since accident for SOL urgency
      let yrs = null;
      if (/השבוע|בחודש האחרון/.test(txt)) yrs = 0;
      else if (/בשנה האחרונה/.test(txt)) yrs = 1;
      else if (/1-3 שנים/.test(txt)) yrs = 2;
      else if (/3-5 שנים/.test(txt)) yrs = 4;
      else if (/5-7 שנים/.test(txt)) yrs = 6;
      else if (/יותר מ-7 שנים|מעל 7 שנים/.test(txt)) yrs = 8;
      newData.yearsSinceAccident = yrs;
      if (isRecent) {
        botMsgs.push({ role: "assistant", content: "\u26A0\uFE0F חשוב מאוד: בשלב זה הראיות עדיין טריות.\nפעל עכשיו:\n- צלם את מקום התאונה ונזקי הרכב\n- שמור את דוח המשטרה\n- אל תדבר עם חוקר הביטוח לבד\n- פנה לטיפול רפואי מיידי אם לא עשית זאת" });
      }
      // SOL urgency — standard 7-year cap (25 for minors; refined after age is known).
      if (yrs != null) {
        const remaining = 7 - yrs;
        if (remaining < 1) {
          botMsgs.push({ role: "assistant", content: "\u26A0\uFE0F נותר פחות משנה לתביעה — דחיפות גבוהה." });
        } else if (remaining <= 3) {
          botMsgs.push({ role: "assistant", content: `שים לב: נותרו כ-${remaining} שנים לתביעה לפי חוק הפלת״ד.` });
        }
      }
      botMsgs.push({ role: "assistant", content: "האם פנית לטיפול רפואי?" });
      setState(STATE_MEDICAL);
      setProgress(33);
      setQuickReplies([
        { label: "כן, אושפזתי", value: "כן, אושפזתי בבית חולים." },
        { label: "כן, טופלתי במיון", value: "כן, טופלתי בחדר מיון." },
        { label: "טיפול אמבולטורי בלבד", value: "קיבלתי טיפול אמבולטורי בלבד." },
        { label: "לא פניתי לטיפול", value: "לא, לא פניתי לטיפול רפואי." },
      ]);

    // ═══ STEP 4: MEDICAL TREATMENT ═══
    } else if (state === STATE_MEDICAL) {
      const yes = YES_RE.test(txt);
      newData.medical = yes;
      if (yes) {
        botMsgs.push({ role: "assistant", content: "\u{1F4A1} מסמכי הטיפול הרפואי הם הבסיס לתביעה." });
      } else {
        botMsgs.push({ role: "assistant", content: "גם ללא טיפול — ייתכן שיש עילת תביעה.\nאך ידע: ללא מסמך רפואי, בתי המשפט נוטים לתת משקל נמוך יותר לתביעה.\nממליץ לפנות לרופא היום — גם בדיעבד זה עוזר." });
      }
      botMsgs.push({ role: "assistant", content: "האם יש לך מסמכי מיון, סיכום אשפוז, או צילומי MRI/CT?" });
      setState(STATE_DOCS);
      setQuickReplies([
        { label: "כן, יש לי מסמכים", value: "כן, יש לי מסמכים רפואיים." },
        { label: "לא, אין לי עדיין", value: "לא, אין לי מסמכים רפואיים עדיין." },
      ]);

    // ═══ STEP 4b: DOCUMENTS ═══
    } else if (state === STATE_DOCS) {
      newData.hasDocs = /כן|יש/.test(txt);
      if (newData.hasDocs) {
        botMsgs.push({ role: "assistant", content: "מצוין — המסמכים יישלחו לעו\"ד דן אלון יחד עם הסיכום." });
      } else {
        botMsgs.push({ role: "assistant", content: "הבנתי. נמשיך בחישוב — את המסמכים אפשר להעביר מאוחר יותר." });
      }
      botMsgs.push({ role: "assistant", content: CONTEXT_QUESTION });
      setState(STATE_CONTEXT);
      setProgress(40);
      setQuickReplies([
        { label: "בדרך לעבודה/ממנה", value: "התאונה קרתה בדרך לעבודה או בחזרה ממנה." },
        { label: "שעות פנויות", value: "התאונה קרתה בשעות פנויות, לא בדרך לעבודה." },
      ]);

    // ═══ STEP 5: WORK ROUTE ═══
    } else if (state === STATE_CONTEXT) {
      const NOT_WORK_RE = /לא בדרך לעבודה|שעות פנויות|לא בעבודה|פרטי/i;
      const isWork = NOT_WORK_RE.test(txt) ? false : WORK_RE.test(txt);
      newData.isWork = isWork;
      botMsgs.push({ role: "assistant", content: contextResponse(isWork) });
      trackStep(5, "work_related");
      botMsgs.push({ role: "assistant", content: LOCATION_QUESTION });
      setState(STATE_LOCATION);
      setProgress(50);

    // ═══ STEP 6: INJURY LOCATION ═══
    } else if (state === STATE_LOCATION) {
      const extracted = extractInjuryInfo(txt);
      let locs = extracted.locations;
      const detectedInjuries = extracted.injuries;
      newData.injuries = {};
      if (locs.length === 0) locs = [txt.trim()];
      newData.locations = locs;

      if (locs.length === 1) {
        const loc = locs[0];
        botMsgs.push({ role: "assistant", content: buildNaturalEcho(txt, locs, detectedInjuries) });
        if (detectedInjuries.length > 0) {
          newData.injuries[loc] = detectedInjuries.join(" + ");
          newData.injury = `${loc}: ${detectedInjuries.join(" + ")}`;
          botMsgs.push({ role: "assistant", content: buildNiiResponse(detectedInjuries.join(" ")) });
          botMsgs.push({ role: "assistant", content: FUNCTIONAL_QUESTION });
          setState(STATE_FUNCTIONAL); setProgress(55);
          setQuickReplies([{ label: "כן, יש קושי", value: "כן, יש לי בעיות תפקודיות." }, { label: "לא, מתפקד רגיל", value: "לא, אין בעיות תפקודיות." }]);
        } else {
          newData.currentLocation = loc;
          botMsgs.push({ role: "assistant", content: `ביחס ל${loc} — מה סוג הפגיעה?` });
          setState(STATE_INJURY_LOOP);
        }
      } else {
        botMsgs.push({ role: "assistant", content: `הבנתי — נפגעת ב${locs.join(", ")}. נעבור על כל אחד בנפרד.` });
        if (detectedInjuries.length > 0) {
          locs.forEach(loc => { newData.injuries[loc] = detectedInjuries.join(" + "); });
          newData.injury = locs.map(loc => `${loc}: ${detectedInjuries.join(" + ")}`).join(", ");
          botMsgs.push({ role: "assistant", content: buildNiiResponse(detectedInjuries.join(" ")) });
          botMsgs.push({ role: "assistant", content: FUNCTIONAL_QUESTION });
          setState(STATE_FUNCTIONAL); setProgress(55);
          setQuickReplies([{ label: "כן, יש קושי", value: "כן, יש לי בעיות תפקודיות." }, { label: "לא, מתפקד רגיל", value: "לא, אין בעיות תפקודיות." }]);
        } else {
          newData.currentLocation = locs[0];
          botMsgs.push({ role: "assistant", content: `ביחס ל${locs[0]} — מה סוג הפגיעה?` });
          setState(STATE_INJURY_LOOP);
        }
      }

    // ═══ STEP 6 LOOP: INJURY TYPE PER LOCATION ═══
    } else if (state === STATE_INJURY_LOOP) {
      const curLoc = newData.currentLocation || data.currentLocation;
      const injuryText = txt.trim().replace(/\.$/, "");
      newData.injuries = { ...data.injuries, ...newData.injuries, [curLoc]: injuryText };
      botMsgs.push({ role: "assistant", content: `הבנתי — ${curLoc}: ${injuryText}.` });
      botMsgs.push({ role: "assistant", content: buildNiiResponse(injuryText) });

      const allLocs = newData.locations.length ? newData.locations : data.locations;
      const processedLocs = Object.keys(newData.injuries);
      const nextLoc = allLocs.find(l => !processedLocs.includes(l));
      if (nextLoc) {
        newData.currentLocation = nextLoc;
        botMsgs.push({ role: "assistant", content: `ביחס ל${nextLoc} — מה סוג הפגיעה?` });
      } else {
        newData.injury = Object.entries(newData.injuries).map(([l, i]) => `${l}: ${i}`).join(", ");
        newData.currentLocation = null;
        botMsgs.push({ role: "assistant", content: FUNCTIONAL_QUESTION });
        setState(STATE_FUNCTIONAL); setProgress(55);
        setQuickReplies([{ label: "כן, יש קושי", value: "כן, יש לי בעיות תפקודיות." }, { label: "לא, מתפקד רגיל", value: "לא, אין בעיות תפקודיות." }]);
      }

    // ═══ STEP 6b: FUNCTIONAL IMPAIRMENT ═══
    } else if (state === STATE_FUNCTIONAL) {
      const hasFunctional = /כן|יש|קושי|הגבלה|מוגבל|חולשה|תפקודי/.test(txt);
      newData.functionalImpairment = hasFunctional;
      if (hasFunctional) {
        botMsgs.push({ role: "assistant", content: "קושי תפקודי מזכה בפיצוי נוסף בגין ׳עזרת צד ג׳׳ — ראש נזק שמעלה משמעותית את סכום הפיצוי הכולל." });
        botMsgs.push({ role: "assistant", content: "האם הרופא ציין שהבעיה צפויה להשתפר לחלוטין, או שהיא עשויה להישאר לטווח ארוך?" });
        setState(STATE_PROGNOSIS); setProgress(58);
        setQuickReplies([
          { label: "צפוי להחלים לחלוטין", value: "הרופא אמר שאני צפוי להחלים לחלוטין." },
          { label: "לא ברור / לא יודע", value: "לא ברור / לא יודע." },
          { label: "להישאר לטווח ארוך", value: "הרופא ציין שהבעיה תישאר לטווח ארוך." },
        ]);
      } else {
        newData.functionalPrognosis = null;
        botMsgs.push({ role: "assistant", content: "הבנתי — אין הגבלה תפקודית משמעותית." });
        botMsgs.push({ role: "assistant", content: DISABILITY_QUESTION });
        setState(STATE_DISABILITY); setProgress(62);
      }

    // ═══ STEP 6c: PROGNOSIS (only when functional limitation confirmed) ═══
    } else if (state === STATE_PROGNOSIS) {
      let prognosis;
      if (/החלים לחלוטין|להחלים|אחלים|החלמה מלאה|יעבור|יחלוף/.test(txt)) {
        prognosis = "full_recovery";
      } else if (/טווח ארוך|תישאר|ישאר|יישאר|צמית|קבוע|לא ישתפר|כרוני/.test(txt)) {
        prognosis = "long_term";
      } else {
        prognosis = "unclear";
      }
      newData.functionalPrognosis = prognosis;
      botMsgs.push({ role: "assistant", content: DISABILITY_QUESTION });
      setState(STATE_DISABILITY); setProgress(62);

    // ═══ STEP 7: DISABILITY ═══
    } else if (state === STATE_DISABILITY) {
      const zeroDisability = /נקבע.*0\s*%|0\s*%\s*נכות|אפס אחוז/.test(txt);
      const pctMatch = txt.match(/(\d+)\s*%?/);
      const notYet = /טרם|עדיין לא|בתהליך|לא נקבעו/.test(txt);
      const noDoc = /לא יודע|אין לי תעודות|אין מסמכים|לא נקבע/.test(txt);

      if (zeroDisability || (pctMatch && parseInt(pctMatch[1]) === 0)) {
        newData.disability = 0; newData.disabilityScenario = "zero";
        botMsgs.push({ role: "assistant", content: "0% נכות צמיתה עדיין מזכה בפיצוי על כאב וסבל לפי ימי האשפוז והטיפול.\nזה לא אומר שאין תביעה — זה אומר שהפיצוי מבוסס על רכיבים אחרים." });
      } else if (pctMatch && parseInt(pctMatch[1]) > 0) {
        newData.disability = Math.min(parseInt(pctMatch[1]), 100); newData.disabilityScenario = "confirmed";
        botMsgs.push({ role: "assistant", content: `${newData.disability}% נכות — זה משמעותי מבחינת הפיצוי.` });
      } else if (notYet) {
        newData.disability = 0; newData.disabilityScenario = "pending";
        const hasFn = newData.functionalImpairment != null ? newData.functionalImpairment : data.functionalImpairment;
        botMsgs.push({ role: "assistant", content: hasFn
          ? "הבנתי — טרם נקבעה נכות, אך ציינת הגבלה תפקודית.\nהגבלה תפקודית יכולה להוות בסיס לנכות תפקודית — שנקבעת על ידי מומחה רפואי.\nאציג שתי הערכות."
          : "הבנתי — טרם נקבעה נכות. אציג שתי הערכות: אחת בהנחת 0% ואחת בהנחת 10%." });
      } else if (noDoc) {
        newData.disability = 0; newData.disabilityScenario = "none";
        botMsgs.push({ role: "assistant", content: "ללא קביעת נכות רשמית, החישוב מבוסס על ימי אשפוז וימי היעדרות בלבד.\n\u26A0\uFE0F ממליץ לפנות לרופא לתיעוד מיידי — ככל שממתינים יותר, קשה יותר להוכיח." });
      } else {
        botMsgs.push({ role: "assistant", content: "כמה אחוזי נכות נקבעו לך? כתוב מספר, או ״לא יודע״." });
        setData(newData); setMsgs(p => [...p, userMsg, ...botMsgs]); return;
      }
      botMsgs.push({ role: "assistant", content: "כמה ימים אושפזת בבית חולים?" });
      setState(STATE_HOSPITALIZATION); setProgress(68);
      setQuickReplies([
        { label: "0 — לא אושפזתי", value: "0" },
        { label: "1-2 ימים", value: "2" },
        { label: "3-7 ימים", value: "5" },
        { label: "7-14 ימים", value: "10" },
        { label: "מעל 14 ימים", value: "20" },
      ]);

    // ═══ STEP 8: HOSPITALIZATION ═══
    } else if (state === STATE_HOSPITALIZATION) {
      const hospMatch = txt.match(/(\d+)/);
      if (!hospMatch) {
        botMsgs.push({ role: "assistant", content: "כמה ימים אושפזת? כתוב מספר, או 0 אם לא אושפזת." });
      } else {
        newData.hospitalizationDays = parseInt(hospMatch[1]);
        botMsgs.push({ role: "assistant", content: newData.hospitalizationDays > 0 ? `${newData.hospitalizationDays} ימי אשפוז — ייכללו בחישוב כאב וסבל.` : "הבנתי — ללא אשפוז." });
        botMsgs.push({ role: "assistant", content: getMonthsOffQuestion(gender) });
        setState(STATE_MONTHS_OFF); setProgress(73);
        setQuickReplies([
          { label: "0 ימים", value: "0" }, { label: "7 ימים", value: "7" },
          { label: "14 ימים", value: "14" }, { label: "30 ימים", value: "30" },
          { label: "60 ימים", value: "60" }, { label: "90+ ימים", value: "90" },
        ]);
      }

    // ═══ STEP 9: DAYS OFF WORK ═══
    } else if (state === STATE_MONTHS_OFF) {
      const daysMatch = txt.match(/(\d+)/);
      if (!daysMatch) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "כמה ימים לא עבדת? כתבי מספר." : "כמה ימים לא עבדת? כתוב מספר." });
      } else {
        newData.monthsOff = parseInt(daysMatch[1]);
        botMsgs.push({ role: "assistant", content: `${newData.monthsOff} ימים — זה ייכלל בחישוב הפסדי השכר.` });
        botMsgs.push({ role: "assistant", content: getAgeQuestion(gender) });
        setState(STATE_AGE); setProgress(80);
      }

    // ═══ STEP 10: AGE ═══
    } else if (state === STATE_AGE) {
      const ageMatch = txt.match(/(\d+)/);
      if (!ageMatch) {
        botMsgs.push({ role: "assistant", content: gender === "female" ? "בת כמה את? כתבי מספר." : "בן כמה אתה? כתוב מספר." });
      } else {
        newData.age = ageMatch[1];
        const salaryQ = gender === "female"
          ? "כמה את משתכרת בחודש ברוטו? (משפיע ישירות על חישוב הפסד השכר)"
          : "כמה אתה משתכר בחודש ברוטו? (משפיע ישירות על חישוב הפסד השכר)";
        botMsgs.push({ role: "assistant", content: salaryQ });
        setState(STATE_SALARY); setProgress(87);
      }

    // ═══ STEP 11: SALARY → CALCULATION ═══
    } else if (state === STATE_SALARY) {
      const scenario = newData.disabilityScenario || data.disabilityScenario;
      let c;
      if (scenario === "pending") {
        const hasFn = newData.functionalImpairment != null ? newData.functionalImpairment : data.functionalImpairment;
        const prognosis = newData.functionalPrognosis != null ? newData.functionalPrognosis : data.functionalPrognosis;
        const severe = hasSevereInjury(newData, [...msgs, userMsg]);

        const showB = !hasFn || prognosis === "full_recovery";
        const showC = hasFn && (prognosis === "unclear" || prognosis === "long_term");
        const showD = showC && severe;

        const fmt = (x) => `₪${x.min.toLocaleString("he-IL")} – ₪${x.max.toLocaleString("he-IL")}`;
        const sA = calculateCompensation(newData, [...msgs, userMsg], 0);
        const sB = showB ? calculateCompensation(newData, [...msgs, userMsg], 10) : null;
        const sC = showC ? calculateCompensation(newData, [...msgs, userMsg], 20) : null;
        const sD = showD ? calculateCompensation(newData, [...msgs, userMsg], 35) : null;

        const parts = [`תרחיש א — ללא נכות (0%):\n${fmt(sA)}`];
        if (sB) parts.push(`תרחיש ב — נכות רפואית לפי תקנות מל"ל (5%–20%):\n${fmt(sB)}`);
        if (sC) parts.push(`תרחיש ג — נכות תפקודית צמיתה (15%–25%):\n${fmt(sC)}`);
        if (sD) parts.push(`תרחיש ד — נכות תפקודית גבוהה (30%+):\n${fmt(sD)}`);

        const intro = "על בסיס הנתונים שלך:";
        const footer = "הקביעה הסופית נעשית על ידי ועדה רפואית. זוהי הערכה ראשונית בלבד.";
        botMsgs.push({ role: "assistant", content: `${intro}\n\n${parts.join("\n\n")}\n\n${footer}` });

        const top = sD || sC || sB || sA;
        c = { min: sA.min, max: top.max, dual: true, zeroMin: sA.min, zeroMax: sA.max, tenMin: top.min, tenMax: top.max };
      } else {
        c = calculateCompensation(newData, [...msgs, userMsg]);
        botMsgs.push({ role: "assistant", content: "על בסיס הנתונים שלך:" });
      }
      if (newData.isWork || data.isWork) {
        botMsgs.push({ role: "assistant", content: "\u26A0\uFE0F הסכום לפני ניכויי ביטוח לאומי. דמי פגיעה: 75% משכרך לעד 13 שבועות." });
      }
      setCalc(c);
      setShowReferral(true);
      setState(STATE_DONE); setProgress(100);
      if (!firedCalcComplete.current) {
        firedCalcComplete.current = true;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "calculation_complete", value_min: c.min, value_max: c.max });
      }
      trackStep(12, "calculation_shown");
      sendToCrm(buildCrmPayload(newData, c, false));

      // CTA variant
      const ctaLabel = getCtaVariant(newData, c);
      setQuickReplies([{ label: ctaLabel, value: "CTA_WHATSAPP" }]);

    // ═══ DONE ═══
    } else if (state === STATE_DONE) {
      if (txt.trim() === "CTA_WHATSAPP") {
        // handled below via notifyWhatsApp
      }
      botMsgs.push({ role: "assistant", content: "בשעות פעילות (א׳–ה׳, 9:00–19:00): דן יחזור אליך תוך פחות מ-60 דקות.\nלחץ על כפתור הוואטסאפ למטה." });
    }

    setData(newData);
    setMsgs(p => [...p, userMsg, ...botMsgs]);
  }

  async function sendDoc() { setErr("בבוט זה אין צורך בצירוף מסמכים. ענה על השאלות ונעזור לך."); }

  function notifyWhatsApp() {
    const conversation = msgs.map(m => m.role === "user" ? `משתמש: ${m.content}` : `בוט: ${m.content}`);
    fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: "whatsapp_click", calculation: calc, conversation }) }).catch(() => {});
    sendToCrm(buildCrmPayload(data, calc, true));
    if (!firedWhatsAppClick.current) {
      firedWhatsAppClick.current = true;
      const params = { event_category: "engagement", event_label: "whatsapp_button", accident_type: roleToLabel(data.role) || undefined, compensation_estimate: calc ? `₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}` : undefined };
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "whatsapp_click", ...params });
    }
  }

  const roleLabelMsg = roleToLabel(data.role);
  let waMsg = "שלום";
  if (data.role) {
    const lines = ["שלום דן, פנייה חדשה מהאתר:"];
    if (data.name) lines.push(`שם: ${data.name}`);
    lines.push(`סוג מעורבות: ${roleLabelMsg}`);
    if (data.medical != null) lines.push(`טיפול רפואי: ${data.medical ? "כן" : "לא"}`);
    if (data.isWork != null) lines.push(`תאונת עבודה: ${data.isWork ? "כן" : "לא"}`);
    if (data.age) lines.push(`גיל: ${data.age}`);
    if (data.injuries && Object.keys(data.injuries).length > 0) {
      lines.push("פגיעות:");
      Object.entries(data.injuries).forEach(([loc, inj]) => lines.push(`  ${loc}: ${inj}`));
    } else if (data.injury) { lines.push(`פגיעה: ${data.injury}`); }
    if (data.functionalImpairment) lines.push("הגבלה תפקודית: כן");
    if (data.disability != null) lines.push(`נכות: ${data.disability}%`);
    if (data.hospitalizationDays != null) lines.push(`ימי אשפוז: ${data.hospitalizationDays}`);
    if (data.monthsOff != null) lines.push(`ימי היעדרות: ${data.monthsOff}`);
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
