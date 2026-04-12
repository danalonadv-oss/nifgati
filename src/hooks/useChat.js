import { useState, useRef, useEffect } from "react";
import { sendToCrm } from "../utils/crm.js";

const WA = "972544338212";

// ═══ State Machine: Nifgati Bot ═══
const STATE_ROLE = 1;
const STATE_MEDICAL = 2;
const STATE_CONTEXT = 3;
const STATE_INJURY = 4;
const STATE_DISABILITY = 5;
const STATE_MONTHS_OFF = 6;
const STATE_AGE = 7;
const STATE_DONE = 8;

const DRIVER_RE = /נהג|נהגת|הנהג/i;
const PASSENGER_RE = /נוסע|נוסעת|יושב/i;
const PEDESTRIAN_RE = /הולך|הולכת|רגל|חצ/i;
const MOTORCYCLE_RE = /אופנוע|קורקינט|אופניים חשמליים/i;
const CAR_RE = /תאונת רכב|ברכב/i;
const WORK_ACCIDENT_RE = /תאונת עבודה|בעבודה/i;
const QUICK_REPLY_PREFIX_RE = /סוג התאונה שלי:/;

const MEDICAL_QUESTION = "האם פונית למיון או לבית חולים?";
const YES_RE = /כן|בטח|פונ|מיון|בית.?חולים|אמבולנס|ניתוח|אשפוז/i;
const NO_RE = /לא|אף|בלי/i;

const CONTEXT_QUESTION = "התאונה קרתה בדרך לעבודה, בחזרה ממנה, או בשעות פנויות?";
const WORK_RE = /עבודה|בדרך ל|בחזרה מ|עובד|נסיעה לעבודה|משמרת/i;

const INJURY_QUESTION = "מה סוג הפגיעה? (למשל: צליפת שוט, שבר, פריצת דיסק, חבלת ראש, PTSD, פגיעה רכה)";
const DISABILITY_QUESTION = "האם נקבעו לך אחוזי נכות?";
const MONTHS_OFF_QUESTION = "כמה ימים לא עבדת (או צפוי שלא תעבוד) בגלל התאונה?";
const AGE_QUESTION = "בן כמה אתה בערך?";

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
    return 'שלום 👋 תאונה בדרך לעבודה מזכה בפיצוי כפול — מביטוח לאומי וגם מפלת״ד. בוא נבדוק יחד כמה מגיע לך.';
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
    return 'שלום 👋 נפגעת בתאונת עבודה? מגיע לך פיצוי מביטוח לאומי ומהמעסיק. בוא נבדוק יחד כמה.';
  if (p.includes('korkinet'))
    return 'שלום 👋 תאונת קורקינט או אופניים חשמליים? גם זה מכוסה בחוק. ספר לי מה קרה.';
  if (p.includes('tzlipat-shot'))
    return 'שלום 👋 צליפת שוט היא פגיעה מוכרת שמזכה בפיצוי — גם ללא שבר. בוא נחשב כמה מגיע לך.';
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

const DEFAULT_OPENING = "שלום 👋 אני הבוט של עו״ד דן אלון — 25 שנות ניסיון בתאונות דרכים ונזקי גוף.\n\nספר לי מה קרה — תוכל להקליד, לדבר 🎙️ או להעלות מסמך רפואי 📎\nאחשב כמה פיצוי מגיע לך תוך דקה, חינם.";
const PERSONALIZED_SUFFIX = "\n\n— עו״ד דן אלון | 25 שנות ניסיון בנזיקין 🏛️\nתוכל להקליד, לדבר 🎙️ או להעלות מסמך 📎";

function getInitialMsgs(customOpening) {
  const content = customOpening
    ? customOpening + PERSONALIZED_SUFFIX
    : DEFAULT_OPENING;
  return [
    { role: "assistant", content, privacy: true },
  ];
}

function classifyRole(txt) {
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
  const map = { driver: "נהג", passenger: "נוסע", pedestrian: "הולך רגל", motorcycle: "רוכב אופנוע", car: "נוסע/נהג ברכב", work: "תאונת עבודה" };
  return map[role] || "";
}

function roleResponse(role) {
  if (role === "driver") return "הבנתי. חברת הביטוח של הנהג האחר אחראית.";
  if (role === "passenger") return "הבנתי. אתה יכול לתבוע גם את חברת הביטוח של הנהג וגם של הרכב שלך.";
  if (role === "motorcycle") return "הבנתי. תאונות אופנוע וקורקינט מזכות לרוב בפיצוי גבוה.";
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
    ? "תאונה בדרך לעבודה — זכאי גם לביטוח לאומי, שני מקורות פיצוי."
    : "מובן. במקרה זה הפיצוי הוא מחברת הביטוח לפי פלת״ד.";
}

function buildSummary(data, calc) {
  const { role, medical, isWork, age, injury, disability, monthsOff } = data;
  const ageNum = parseInt(age) || 30;
  const roleLabel = roleToLabel(role) || "לא צוין";
  const contextLabel = isWork ? "תאונה בדרך לעבודה (זכאות כפולה — ביטוח + ביטוח לאומי)" : "תאונה פרטית";
  const medLabel = medical ? "פנה למיון — ראיה רפואית חזקה" : "לא פנה למיון";

  return `סיכום:\n• תפקיד: ${roleLabel}\n• ${medLabel}\n• ${contextLabel}\n• פגיעה: ${injury || "לא צוין"}\n• אחוזי נכות: ${disability}%\n• חודשי היעדרות: ${monthsOff}\n• גיל: ${ageNum}\n\nהערכת פיצוי ראשונית: ₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}\n\nזוהי הערכה ראשונית בלבד לפי נוסחת הפלת״ד. לחץ על הכפתור למטה כדי לדבר עם עו"ד דן אלון בוואטסאפ ולקבל הערכה מדויקת.`;
}


const INITIAL_QUICK_REPLIES = [
  { label: "\u{1F468} אני גבר", value: "GENDER:male" },
  { label: "\u{1F469} אני אישה", value: "GENDER:female" },
];

const ACCIDENT_QUICK_REPLIES = [
  { label: "\u{1F697} \u200Fתאונת רכב", value: "סוג התאונה שלי: תאונת רכב." },
  { label: "\u{1F3CD}\uFE0F \u200Fאופנוע / קורקינט", value: "סוג התאונה שלי: תאונת אופנוע או קורקינט." },
  { label: "\u{1F6B6} \u200Fהולך/ת רגל", value: "סוג התאונה שלי: נפגעתי כהולך רגל." },
  { label: "\u{1F3D7}\uFE0F \u200Fתאונת עבודה", value: "סוג התאונה שלי: תאונת עבודה." },
];

const EARLY_ESTIMATE_MSG = "נפגעי תאונות דרכים מקבלים בממוצע בין \u20AA50,000 ל-\u20AA500,000 בהתאם לחומרת הפציעה. בוא נחשב את הסכום המדויק שלך — כמה שאלות קצרות ואגיע למספר.";

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

export default function useChat(customOpening) {
  const [msgs, setMsgs] = useState([...getInitialMsgs(customOpening)]);
  const [inp, setInp] = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(null);
  const [err, setErr] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [state, setState] = useState(STATE_ROLE);
  const [data, setData] = useState({ role: null, medical: null, isWork: null, injury: null, disability: null, monthsOff: null, age: null });
  const [quickReplies, setQuickReplies] = useState(INITIAL_QUICK_REPLIES);
  const [progress, setProgress] = useState(0);
  const [gender, setGender] = useState(null);
  const endRef = useRef(null);
  const hasInteracted = useRef(false);
  const shownEarlyEstimate = useRef(false);
  const shownUrgency = useRef(false);
  const shownSocialProof = useRef(false);
  const userMsgCount = useRef(0);

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
    const injuryAnswered = userMsgs.some(m => m.content.includes("סוג הפגיעה:"));
    const disabilityAnswered = userMsgs.some(m => m.content.includes("נקבעו לי אחוזי נכות") || m.content.includes("אחוזי הנכות שלי:") || m.content.includes("בתהליך קביעת"));
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

    // Detect injury type question
    if (!injuryAnswered && (inEither('סוג הפגיע') || bothInEither('פגיע', 'למשל') || bothInEither('שבר', 'למשל') || bothInEither('צליפת שוט', 'למשל') || inEither('חבלת ראש') || bothInEither('פריצת דיסק', 'למשל'))) {
      setQuickReplies([
        { label: "שבר", value: "סוג הפגיעה: שבר." },
        { label: "צליפת שוט / כאבי צוואר", value: "סוג הפגיעה: צליפת שוט וכאבי צוואר." },
        { label: "פריצת דיסק / כאבי גב", value: "סוג הפגיעה: פריצת דיסק או כאבי גב." },
        { label: "חבלת ראש / PTSD", value: "סוג הפגיעה: חבלת ראש או PTSD." },
        { label: "פגיעה בברך / מפרק", value: "סוג הפגיעה: פגיעה בברך או מפרק." },
        { label: "פגיעה רכה / חבורות", value: "סוג הפגיעה: פגיעה רכה וחבורות." },
        { label: "אחר — אקליד בעצמי", value: "OPEN_INPUT" },
      ]);
      return;
    }

    // Detect disability question
    if (!disabilityAnswered && (inEither('אחוזי נכות') || (inEither('נכות') && (inEither('נקבעו') || inEither('קבעו'))))) {
      setQuickReplies([
        { label: "כן, נקבעו לי אחוזי נכות", value: "כן, נקבעו לי אחוזי נכות." },
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
    if (/משתכר|שכר|הכנסה|מרוויח/.test(content) || /משתכר|שכר|הכנסה|מרוויח/.test(prevContent)) {
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
    setState(STATE_ROLE);
    setData({ role: null, medical: null, isWork: null, injury: null, disability: null, monthsOff: null, age: null });
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

    // Handle free input option
    if (txt.trim() === "OPEN_INPUT") {
      const openMsg = gender === "female"
        ? "ספרי לי מה קרה — תוכלי להקליד, לדבר \uD83C\uDF99\uFE0F או להעלות מסמך רפואי \uD83D\uDCCE"
        : gender === "male"
        ? "ספר לי מה קרה — תוכל להקליד, לדבר \uD83C\uDF99\uFE0F או להעלות מסמך רפואי \uD83D\uDCCE"
        : "ספר/י לי מה קרה — תוכל/י להקליד, לדבר \uD83C\uDF99\uFE0F או להעלות מסמך רפואי \uD83D\uDCCE";
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
        botMsgs.push({ role: "assistant", content: "לא הבנתי. היית הנהג, נוסע, או הולך רגל?" });
      } else {
        newData.role = role;
        botMsgs.push({ role: "assistant", content: roleResponse(role) });
        // Early estimate — show once after first answer
        if (!shownEarlyEstimate.current) {
          shownEarlyEstimate.current = true;
          botMsgs.push({ role: "assistant", content: EARLY_ESTIMATE_MSG });
        }
        botMsgs.push({ role: "assistant", content: MEDICAL_QUESTION });
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
        botMsgs.push({ role: "assistant", content: "פונית למיון או לבית חולים? כן או לא?" });
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
      botMsgs.push({ role: "assistant", content: INJURY_QUESTION });
      setState(STATE_INJURY);
      trackStep(4, "work_related");
    } else if (state === STATE_INJURY) {
      newData.injury = txt.trim();
      const cleanInjury = txt.trim().replace(/\.$/, "");
      botMsgs.push({ role: "assistant", content: `הבנתי — ${cleanInjury}. חשוב לתעד את זה.` });
      // Social proof — show once based on injury type
      if (!shownSocialProof.current) {
        shownSocialProof.current = true;
        botMsgs.push({ role: "assistant", content: getSocialProof(txt) });
      }
      botMsgs.push({ role: "assistant", content: DISABILITY_QUESTION });
      setState(STATE_DISABILITY);
      setProgress(50);
    } else if (state === STATE_DISABILITY) {
      const pctMatch = txt.match(/(\d+)\s*%?/);
      const dontKnow = /לא יודע|לא נקבע|אין|טרם|עדיין לא|בתהליך/.test(txt);
      if (pctMatch) {
        newData.disability = Math.min(parseInt(pctMatch[1]), 100);
        botMsgs.push({ role: "assistant", content: `${newData.disability}% נכות — זה משמעותי מבחינת הפיצוי.` });
      } else if (dontKnow) {
        newData.disability = estimateDisability(newData.injury);
        botMsgs.push({ role: "assistant", content: `הבנתי. לפי סוג הפגיעה אני מעריך בערך ${newData.disability}% נכות לצורך החישוב. עו״ד אלון יוכל לתת הערכה מדויקת יותר.` });
      } else {
        botMsgs.push({ role: "assistant", content: "כמה אחוזי נכות נקבעו לך? כתוב מספר, או ״לא יודע״." });
        setData(newData);
        setMsgs(p => [...p, userMsg, ...botMsgs]);
        return;
      }
      botMsgs.push({ role: "assistant", content: MONTHS_OFF_QUESTION });
      setState(STATE_MONTHS_OFF);
      setProgress(75);
    } else if (state === STATE_MONTHS_OFF) {
      const monthMatch = txt.match(/(\d+)/);
      if (!monthMatch) {
        botMsgs.push({ role: "assistant", content: "כמה ימים לא עבדת? כתוב מספר." });
      } else {
        newData.monthsOff = parseInt(monthMatch[1]);
        botMsgs.push({ role: "assistant", content: `${newData.monthsOff} ימים — זה ייכלל בחישוב הפסדי השכר.` });
        botMsgs.push({ role: "assistant", content: AGE_QUESTION });
        setState(STATE_AGE);
        trackStep(5, "age_asked");
      }
    } else if (state === STATE_AGE) {
      const ageMatch = txt.match(/(\d+)/);
      if (!ageMatch) {
        botMsgs.push({ role: "assistant", content: "בן כמה אתה? כתוב מספר." });
      } else {
        newData.age = ageMatch[1];
        const c = calculateCompensation(newData, [...msgs, userMsg]);
        const summary = buildSummary(newData, c);
        botMsgs.push({ role: "assistant", content: summary });
        setCalc(c);
        setShowReferral(true);
        setState(STATE_DONE);
        setProgress(100);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "calculation_complete", value_min: c.min, value_max: c.max });
        trackStep(6, "calculation_shown");
        trackStep(7, "cta_shown");
        // CRM: qualified lead (bot completed)
        sendToCrm(buildCrmPayload(newData, c, false));
      }
    } else if (state === STATE_DONE) {
      botMsgs.push({ role: "assistant", content: "לחץ על הכפתור למטה כדי לשוחח עם עו\"ד דן אלון בוואטסאפ." });
    }

    // Urgency message — after 3+ messages without calc
    if (userMsgCount.current >= 3 && !calc && !shownUrgency.current && state !== STATE_DONE) {
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

    // GA4 whatsapp_click with lead details
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
    if (data.injury) lines.push(`פגיעה: ${data.injury}`);
    if (data.disability != null) lines.push(`נכות: ${data.disability}%`);
    if (calc) lines.push(`הערכת פיצוי: ₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}`);
    lines.push("אשמח לבדיקה מעמיקה.");
    waMsg = lines.join("\n");
  }

  return {
    msgs, inp, setInp, load, setLoad, calc, err, setErr,
    showReferral, send, sendDoc, restart, waMsg, endRef, WA, notifyWhatsApp,
    quickReplies, handleQuickReply, progress, gender,
  };
}
