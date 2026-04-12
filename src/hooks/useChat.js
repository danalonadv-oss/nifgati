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

const ROLE_QUESTION = "חוק הפיצויים לנפגעי תאונות דרכים בישראל מבטיח פיצוי כמעט בכל מקרה של פציעה. זה לא תלוי בזה מי אשם.\n\nהיית הנהג, נוסע, או הולך רגל בתאונה?";

const DRIVER_RE = /נהג|נהגת|הנהג/i;
const PASSENGER_RE = /נוסע|נוסעת|יושב/i;
const PEDESTRIAN_RE = /הולך|הולכת|רגל|חצ/i;

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
  const roleLabel = data.role === "driver" ? "נהג" : data.role === "passenger" ? "נוסע" : data.role === "pedestrian" ? "הולך רגל" : "";
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
  if (DRIVER_RE.test(txt)) return "driver";
  if (PASSENGER_RE.test(txt)) return "passenger";
  if (PEDESTRIAN_RE.test(txt)) return "pedestrian";
  return null;
}

function roleResponse(role) {
  if (role === "driver") return "הבנתי. חברת הביטוח של הנהג האחר אחראית.";
  if (role === "passenger") return "הבנתי. אתה יכול לתבוע גם את חברת הביטוח של הנהג וגם של הרכב שלך.";
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
  const roleLabel = role === "driver" ? "נהג" : role === "passenger" ? "נוסע" : "הולך רגל";
  const contextLabel = isWork ? "תאונה בדרך לעבודה (זכאות כפולה — ביטוח + ביטוח לאומי)" : "תאונה פרטית";
  const medLabel = medical ? "פנה למיון — ראיה רפואית חזקה" : "לא פנה למיון";

  return `סיכום:\n• תפקיד: ${roleLabel}\n• ${medLabel}\n• ${contextLabel}\n• פגיעה: ${injury || "לא צוין"}\n• אחוזי נכות: ${disability}%\n• חודשי היעדרות: ${monthsOff}\n• גיל: ${ageNum}\n\nהערכת פיצוי ראשונית: ₪${calc.min.toLocaleString("he-IL")} – ₪${calc.max.toLocaleString("he-IL")}\n\nזוהי הערכה ראשונית בלבד לפי נוסחת הפלת״ד. לחץ על הכפתור למטה כדי לדבר עם עו"ד דן אלון בוואטסאפ ולקבל הערכה מדויקת.`;
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
  const endRef = useRef(null);
  const hasInteracted = useRef(false);

  useEffect(() => { if (hasInteracted.current) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, load]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 6000); return () => clearTimeout(t); }, [err]);

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

  function send(txt) {
    if (!txt.trim() || load) return;
    if (!hasInteracted.current) trackStep(1, "bot_opened");
    hasInteracted.current = true;
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
        botMsgs.push({ role: "assistant", content: MEDICAL_QUESTION });
        setState(STATE_MEDICAL);
        trackStep(2, "accident_type");
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
      botMsgs.push({ role: "assistant", content: DISABILITY_QUESTION });
      setState(STATE_DISABILITY);
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
    const roleLabel = data.role === "driver" ? "נהג" : data.role === "passenger" ? "נוסע" : data.role === "pedestrian" ? "הולך רגל" : "";
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
  const roleLabelMsg = data.role === "driver" ? "נהג" : data.role === "passenger" ? "נוסע" : data.role === "pedestrian" ? "הולך רגל" : "";
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
  };
}
