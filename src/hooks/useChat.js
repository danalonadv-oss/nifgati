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
const MONTHS_OFF_QUESTION = "כמה חודשים לא עבדת (או צפוי שלא תעבוד) בגלל התאונה?";
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

// ── Paltad-based calculation ──
function calculateCompensation(data) {
  const ageNum = parseInt(data.age) || 30;
  const disability = data.disability || 10;
  const monthsOff = data.monthsOff || 3;
  const salary = 11000; // default average salary

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
  if (role === "work") return "הבנתי. תאונת עבודה מזכה בפיצוי ממספר מקורות — ביטוח לאומי וגם פלת״ד.";
  return "הבנתי. זה דורש הוכחה אבל יש לך זכויות.";
}

function medicalResponse(yes) {
  return yes
    ? "זה חשוב מאוד. הטיפול הרפואי הוא ראיה חזקה."
    : "הבנתי. גם ללא אשפוז יכול להיות לך קייס. יש לך כאבים או פגיעות?";
}

function contextResponse(isWork) {
  return isWork
    ? "זה משנה הכל לטובתך! אתה זכאי לפיצוי גם מול ביטוח לאומי. זה שני מקורות פיצוי."
    : "בסדר, אתה תתבוע את חברת הביטוח של הרכב.";
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

const URGENCY_MSG = "\u{1F4A1} תביעות פלת\u05F4ד מתיישנות תוך 7 שנים מיום התאונה. עדיף לבדוק את זכויותיך עכשיו — זה חינם ולא מחייב.";

function getSocialProof(txt) {
  const t = (txt || "").toLowerCase();
  if (/אופנוע/.test(t))
    return "לקוח שלנו עם פציעה דומה בתאונת אופנוע קיבל \u20AA680,000 — בוא נבדוק מה מגיע לך.";
  if (/קורקינט/.test(t))
    return "לקוח שלנו שנפל מקורקינט קיבל \u20AA185,000 — בוא נבדוק מה מגיע לך.";
  if (/הולך רגל/.test(t))
    return "הולכי רגל שנפגעו בתאונה מקבלים פיצוי מלא — לקוח שלנו קיבל \u20AA320,000.";
  return "לקוחות שלנו עם פציעות דומות קיבלו בין \u20AA150,000 ל-\u20AA680,000 — בוא נחשב את הסכום המדויק שלך.";
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

  // Detect bot questions and show contextual quick replies
  useEffect(() => {
    const lastBotMsg = msgs.filter(m => m.role === "assistant").slice(-1)[0];
    if (!lastBotMsg || quickReplies.length > 0) return;
    const content = lastBotMsg.content;

    // Detect hospital question
    if (content.includes('מיון') || content.includes('בית חולים') || content.includes('פנית לטיפול') || content.includes('טיפול רפואי')) {
      setQuickReplies([
        { label: "כן, פניתי למיון / בית חולים", value: "כן, פניתי למיון או לבית חולים." },
        { label: "לא פניתי לטיפול רפואי", value: "לא, לא פניתי לטיפול רפואי." },
      ]);
      return;
    }

    // Detect work route question
    if (content.includes('דרך לעבודה') || content.includes('בחזרה ממנה') || content.includes('שעות פנויות') || content.includes('בדרך לעבודה')) {
      setQuickReplies([
        { label: "כן, בדרך לעבודה או חזרה", value: "התאונה קרתה בדרך לעבודה או בחזרה ממנה." },
        { label: "לא, בשעות פנויות", value: "התאונה קרתה בשעות פנויות, לא בדרך לעבודה." },
      ]);
      return;
    }

    // Detect salary question
    if (/משתכר|שכר|הכנסה|מרוויח/.test(content)) {
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

    // Handle gender selection
    if (txt.trim().startsWith("GENDER:")) {
      const g = txt.trim().replace("GENDER:", "");
      setGender(g);
      setQuickReplies(ACCIDENT_QUICK_REPLIES);
      setInp("");
      hasInteracted.current = true;
      const greeting = g === "female"
        ? "ספרי לי מה קרה — איזו תאונה עברת?"
        : "ספר לי מה קרה — איזו תאונה עברת?";
      setMsgs(prev => [...prev, { role: "assistant", content: greeting }]);
      return;
    }

    if (!hasInteracted.current) trackStep(1, "bot_opened");
    hasInteracted.current = true;
    userMsgCount.current++;
    setQuickReplies([]);
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
      const isWork = WORK_RE.test(txt);
      newData.isWork = isWork;
      botMsgs.push({ role: "assistant", content: contextResponse(isWork) });
      botMsgs.push({ role: "assistant", content: INJURY_QUESTION });
      setState(STATE_INJURY);
      trackStep(4, "work_related");
    } else if (state === STATE_INJURY) {
      newData.injury = txt.trim();
      botMsgs.push({ role: "assistant", content: `הבנתי — ${txt.trim()}. חשוב לתעד את זה.` });
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
      const dontKnow = /לא יודע|לא נקבע|אין|טרם|עדיין לא/.test(txt);
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
        botMsgs.push({ role: "assistant", content: "כמה חודשים לא עבדת? כתוב מספר (למשל: 3)." });
      } else {
        newData.monthsOff = parseInt(monthMatch[1]);
        botMsgs.push({ role: "assistant", content: `${newData.monthsOff} חודשים — זה ייכלל בחישוב הפסדי השכר.` });
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
        const c = calculateCompensation(newData);
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
