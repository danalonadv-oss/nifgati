import { useState, useRef, useEffect } from "react";

const WA = "972544338212";
const MY_NAME = "דן אלון";

const GREETING_1 = {
  role: "assistant",
  content: `שלום 👋\n\nנפגעת בתאונה? בוא נבדוק ב-60 שניות כמה פיצוי מגיע לך.\n\n🎙️ דבר/י, כתוב/י, או 📎 צרף/י מסמך רפואי.`,
  privacy: true,
};
const GREETING_2 = {
  role: "assistant",
  content: "ספר/י לי בקצרה: מה קרה, בן כמה את/ה, כמה את/ה משתכר/ת ואיפה נפגעת בגוף?",
};
const INITIAL_MSGS = [GREETING_1, GREETING_2];
const CTA_MSG = `ניתן לעבור בכל שלב להתייעצות עם עורך דין ${MY_NAME} לתכנון הצעדים הבאים ומיקסום הפיצוי.`;
const REFERRAL_RE = /עורך.?דין|עו"ד|דן אלון|לדבר עם|להעביר|תעביר|אנושי|בן.?אדם|lawyer/i;

function parseCalc(t) {
  if (!t.includes("---חישוב---")) return null;
  const mn = t.match(/סה"כ מינימום:\s*₪([\d,]+)/);
  const mx = t.match(/סה"כ מקסימום:\s*₪([\d,]+)/);
  if (!mn || !mx) return null;
  return { min: parseInt(mn[1].replace(/,/g, "")), max: parseInt(mx[1].replace(/,/g, "")) };
}

function extractPhone(msgs) {
  const userMsgs = msgs.filter(m => m.role === "user" && typeof m.content === "string").slice(-5);
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const match = userMsgs[i].content.match(/0[2-9]\d[\d-]{6,9}/);
    if (match) return match[0].replace(/-/g, "");
  }
  return "";
}

function notifyLead(msgs, calc) {
  try {
    const phone = extractPhone(msgs);
    const userMsgs = msgs.filter(m => m.role === "user" && typeof m.content === "string");
    const injury = userMsgs.length > 0 ? userMsgs[0].content.slice(0, 120) : "";
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "lead", calculation: calc, phone, injury }),
    }).catch(() => {});
  } catch (_) {}
}

async function callClaude(messages, model = "claude-haiku-4-5-20251001") {
  const cleaned = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: cleaned, model }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "שגיאה");
  }
  const d = await r.json();
  const text = d.content?.[0]?.text;
  if (!text) throw new Error("תשובה ריקה — נסה שוב.");
  return text;
}

export default function useChat() {
  const [msgs, setMsgs] = useState([...INITIAL_MSGS]);
  const [inp, setInp] = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(null);
  const [err, setErr] = useState("");
  const [ctaShown, setCtaShown] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, load]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 6000); return () => clearTimeout(t); }, [err]);

  function restart() {
    setMsgs([...INITIAL_MSGS]);
    setCalc(null);
    setInp("");
    setErr("");
    setCtaShown(false);
    setShowReferral(false);
  }

  function handleCalc(rep, updatedMsgs) {
    const c = parseCalc(rep);
    if (c) {
      setCalc(c);
      setShowReferral(true);
      notifyLead(updatedMsgs, c);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "calculation_complete", value_min: c.min, value_max: c.max });
    }
    return c;
  }

  async function send(txt) {
    if (!txt.trim() || load) return;
    setErr("");
    setInp("");

    if (REFERRAL_RE.test(txt)) {
      setMsgs(p => [...p,
        { role: "user", content: txt },
        { role: "assistant", content: `בשמחה! עו"ד ${MY_NAME} ישמח לעזור. לחץ על הכפתור למטה לשליחת הפרטים בוואטסאפ.` },
      ]);
      setShowReferral(true);
      return;
    }

    const next = [...msgs, { role: "user", content: txt }];
    setMsgs(next);
    setLoad(true);
    try {
      const rep = await callClaude(next.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : "[הודעה]" })));
      const updated = [...next, { role: "assistant", content: rep }];
      const userCount = next.filter(m => m.role === "user").length;
      if (!ctaShown && (userCount === 1 || userCount >= 3)) {
        updated.push({ role: "assistant", content: CTA_MSG });
        setCtaShown(true);
      }
      setMsgs(updated);
      if (userCount === 1) notifyLead(updated, null);
      handleCalc(rep, updated);
    } catch (e) {
      setErr(e.message || "שגיאת חיבור");
    }
    setLoad(false);
  }

  async function sendDoc(userContent, displayName) {
    const displayMsg = { role: "user", content: `📎 צורף מסמך: ${displayName}` };
    const next = [...msgs, displayMsg];
    setMsgs(next);

    const historyMsgs = msgs.map(m => {
      if (Array.isArray(m.content)) {
        const textParts = m.content.filter(p => p.type === "text").map(p => p.text).join(" ");
        return { role: m.role, content: textParts || "[מסמך שנותח]" };
      }
      return { role: m.role, content: typeof m.content === "string" ? m.content : "[הודעה]" };
    });
    const userMsg = { role: "user", content: userContent };
    const apiMsgs = [...historyMsgs, userMsg];
    const rep = await callClaude(apiMsgs, "claude-sonnet-4-20250514");
    setMsgs(p => [...p, { role: "assistant", content: rep }]);
    handleCalc(rep, [...historyMsgs, { role: "assistant", content: rep }]);
    if (!ctaShown) {
      setMsgs(p => [...p, { role: "assistant", content: CTA_MSG }]);
      setCtaShown(true);
    }
  }

  // Computed values for WhatsApp CTA
  const userMsgs = msgs.filter(m => m.role === "user").map(m => typeof m.content === "string" ? m.content : "").filter(Boolean);
  const allText = userMsgs.join(" ");
  const ageMatch = allText.match(/בן\s*(\d+)|בת\s*(\d+)|(\d+)\s*שנ/);
  const age = ageMatch ? (ageMatch[1] || ageMatch[2] || ageMatch[3]) : "";
  const salaryMatch = allText.match(/([\d,]+)\s*(?:₪|שקל|ש"ח|שכר|ברוטו)/);
  const salary = salaryMatch ? salaryMatch[1] : "";
  const isWork = /עבודה|בדרך ל/.test(allText);
  const injuryWords = userMsgs[0] ? userMsgs[0].slice(0, 100) : "";

  const waMsg = calc
    ? `היי אלון, קיבלתי הערכה מהבוט עבור ${injuryWords} בתאונה ${isWork ? "בדרך לעבודה" : "פרטית"}.${age ? ` אני בן ${age}.` : ""}${salary ? ` משתכר ${salary} ₪.` : ""}\nהערכת פיצוי: ₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}.\nאשמח לבדיקה שלך.`
    : userMsgs.length
      ? `היי דני, הגעתי מהבוט. תיאור: ${userMsgs.slice(0, 3).join(" | ").slice(0, 200)}. אשמח לפרטים.`
      : "היי דני, הגעתי מהבוט ואשמח לפרטים.";

  return {
    msgs, inp, setInp, load, setLoad, calc, err, setErr,
    showReferral, send, sendDoc, restart, waMsg, endRef, WA,
  };
}
