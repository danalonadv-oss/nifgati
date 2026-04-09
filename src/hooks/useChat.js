import { useState, useRef, useEffect } from "react";

const WA = "972544338212";

// ═══ State Machine: Nifgati Bot ═══
// STATE 1: Entry greeting (auto)
// STATE 2: Role — driver / passenger / pedestrian
// STATE 3: Medical — ER visit?
// STATE 4: Context — work commute or personal?
// STATE 5: Age → Summary + WhatsApp CTA

const STATE_ENTRY = 1;
const STATE_ROLE = 2;
const STATE_MEDICAL = 3;
const STATE_CONTEXT = 4;
const STATE_AGE = 5;
const STATE_DONE = 6;

const ROLE_QUESTION = "חוק הפיצויים לנפגעי תאונות דרכים בישראל מבטיח פיצוי כמעט בכל מקרה של פציעה. זה לא תלוי בזה מי אשם.\n\nהיית הנהג, נוסע, או הולך רגל בתאונה?";

const DRIVER_RE = /נהג|נהגת|הנהג/i;
const PASSENGER_RE = /נוסע|נוסעת|יושב/i;
const PEDESTRIAN_RE = /הולך|הולכת|רגל|חצ/i;

const MEDICAL_QUESTION = "האם פונית למיון או לבית חולים?";
const YES_RE = /כן|בטח|פונ|מיון|בית.?חולים|אמבולנס|ניתוח|אשפוז/i;
const NO_RE = /לא|אף|בלי/i;

const CONTEXT_QUESTION = "התאונה קרתה בדרך לעבודה, בחזרה ממנה, או בשעות פנויות?";
const WORK_RE = /עבודה|בדרך ל|בחזרה מ|עובד|נסיעה לעבודה|משמרת/i;

const AGE_QUESTION = "בן כמה אתה בערך?";

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source'),
    term: params.get('utm_term'),
    content: params.get('utm_content'),
    page: window.location.pathname
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

function getInitialMsgs() {
  return [
    { role: "assistant", content: getPersonalizedOpening(), privacy: true },
    { role: "assistant", content: ROLE_QUESTION },
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

function buildSummary(data) {
  const { role, medical, isWork, age } = data;
  const ageNum = parseInt(age) || 30;
  const min = 50000;
  const max = 250000;
  const roleLabel = role === "driver" ? "נהג" : role === "passenger" ? "נוסע" : "הולך רגל";
  const contextLabel = isWork ? "תאונה בדרך לעבודה (זכאות כפולה — ביטוח + ביטוח לאומי)" : "תאונה פרטית";
  const medLabel = medical ? "פנה למיון — ראיה רפואית חזקה" : "לא פנה למיון";

  return `סיכום:\n• תפקיד: ${roleLabel}\n• ${medLabel}\n• ${contextLabel}\n• גיל: ${ageNum}\n\nהערכת פיצוי ראשונית: ₪${min.toLocaleString("he-IL")} – ₪${max.toLocaleString("he-IL")}\n\nזוהי הערכה ראשונית בלבד. לחץ על הכפתור למטה כדי לדבר עם עו"ד דן אלון בוואטסאפ ולקבל הערכה מדויקת.`;
}


export default function useChat() {
  const [msgs, setMsgs] = useState([...getInitialMsgs()]);
  const [inp, setInp] = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(null);
  const [err, setErr] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [state, setState] = useState(STATE_ROLE);
  const [data, setData] = useState({ role: null, medical: null, isWork: null, age: null });
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, load]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 6000); return () => clearTimeout(t); }, [err]);

  function restart() {
    setMsgs([...getInitialMsgs()]);
    setCalc(null);
    setInp("");
    setErr("");
    setShowReferral(false);
    setState(STATE_ROLE);
    setData({ role: null, medical: null, isWork: null, age: null });
  }

  function send(txt) {
    if (!txt.trim() || load) return;
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
      }
    } else if (state === STATE_CONTEXT) {
      const isWork = WORK_RE.test(txt);
      newData.isWork = isWork;
      botMsgs.push({ role: "assistant", content: contextResponse(isWork) });
      botMsgs.push({ role: "assistant", content: AGE_QUESTION });
      setState(STATE_AGE);
    } else if (state === STATE_AGE) {
      const ageMatch = txt.match(/(\d+)/);
      if (!ageMatch) {
        botMsgs.push({ role: "assistant", content: "בן כמה אתה? כתוב מספר." });
      } else {
        newData.age = ageMatch[1];
        const summary = buildSummary(newData);
        botMsgs.push({ role: "assistant", content: summary });
        const c = { min: 50000, max: 250000 };
        setCalc(c);
        setShowReferral(true);
        setState(STATE_DONE);
        console.log('DEBUG: About to fire calculation_complete', { min: c.min, max: c.max });
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "calculation_complete", value_min: c.min, value_max: c.max });
        console.log('DEBUG: calculation_complete fired');
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
  }

  // WhatsApp message
  const waMsg = calc
    ? `שלום, הגעתי מהבוט של ניפגעתי.\nתפקיד: ${data.role === "driver" ? "נהג" : data.role === "passenger" ? "נוסע" : "הולך רגל"}\nגיל: ${data.age}\nתאונה: ${data.isWork ? "בדרך לעבודה" : "פרטית"}\nהערכת פיצוי: ₪50,000–₪250,000\nאשמח לבדיקה.`
    : "שלום";

  return {
    msgs, inp, setInp, load, setLoad, calc, err, setErr,
    showReferral, send, sendDoc, restart, waMsg, endRef, WA, notifyWhatsApp,
  };
}
