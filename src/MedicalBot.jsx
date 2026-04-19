// src/MedicalBot.jsx — Atticus-style quiz (2026-04 rebuild)
// ─────────────────────────────────────────────────────────
// 5 question screens → 1 results → 1 contact form → 1 thank-you.
// Indicator matching (legacy Claude call) removed; category detection
// happens locally via answer-label pass-through to the CRM.
// ─────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { captureGclid, getGclid } from "./utils/gclid.js";

// ── Brand palette ──
const G          = "#0a2240";
const BLUE       = "#1a4a7a";
const ACCENT     = "#2a7ab5";
const GOLD       = "#F4A300";
const WA_GREEN   = "#25d366";
const AMBER_BG   = "rgba(184, 134, 11, 0.1)";
const AMBER_TEXT = "#b8860b";
const GREEN_BG   = "#dcf3eb";
const GREEN_TEXT = "#2d6e5a";
const RED_URGENT = "#c23b22";

const WA_PHONE = "972544338212";
const SOL_YEARS = 7;

// ── Question option data ──
const Q1_OPTIONS = [
  { id: "surgery",    label: "ניתוח או פעולה פולשנית", sub: "סיבוך, פגיעה לא צפויה, טעות בצד/איבר" },
  { id: "diagnosis",  label: "אבחון שהתעכב או שגה",    sub: "סרטן, שבץ, אוטם, אפנדיציט" },
  { id: "birth",      label: "לידה — פגיעה באם או בתינוק", sub: "קיסרי, צליפת שוט, שיתוק מוחין" },
  { id: "medication", label: "תרופות ומינונים",         sub: "טעות מינון, תרופה שגויה, אינטראקציה" },
  { id: "infection",  label: "זיהום או ספסיס לאחר טיפול", sub: "זיהום ניתוחי, אלח דם, MRSA" },
  { id: "other",      label: "אחר / לא בטוח",           sub: "נתאר יחד את המקרה" },
];

const Q2_OPTIONS = [
  { id: "recent", label: "בחודשים האחרונים",    yearsAgo: 0.5 },
  { id: "1-2",    label: "לפני שנה — שנתיים",    yearsAgo: 1.5 },
  { id: "3-5",    label: "לפני 3–5 שנים",        yearsAgo: 4   },
  { id: "6-7",    label: "לפני 6–7 שנים",        yearsAgo: 6.5 },
  { id: "over-7", label: "לפני יותר מ-7 שנים",   yearsAgo: 8   },
];

const Q3_OPTIONS = [
  { id: "full",      label: "כן — בהרחבה, גם בכתב",    sub: "חלופות, סיכונים, סיכויי הצלחה" },
  { id: "brief",     label: "הסביר בקצרה, רק בע״פ",     sub: "ללא מסמך מפורט" },
  { id: "sign-only", label: "רק ביקש/ה שאחתום על טופס", sub: "", flag: "autonomy" },
  { id: "none",      label: "לא הוסבר לי דבר",          sub: "", flag: "autonomy-severe" },
  { id: "unsure",    label: "לא זוכר/ת",                sub: "" },
];

const Q4_OPTIONS = [
  { id: "permanent",  label: "יש נזק קבוע / נכות שלא תחלוף",    icon: "🔴" },
  { id: "treatments", label: "דרשו טיפולים נוספים שלא הייתי צריך/ה", icon: "🟠" },
  { id: "work",       label: "אני לא מסוגל/ת לעבוד כמו קודם",   icon: "🟡" },
  { id: "mental",     label: "יש לי סיוטים / חרדה / PTSD",       icon: "🔵" },
  { id: "early",      label: "עוד מוקדם לדעת — אני בתהליך",      icon: "⚪" },
];

const Q5_OPTIONS = [
  { id: "partial",   label: "כן — חלקיים",           sub: "סיכום שחרור, דוחות כלליים" },
  { id: "full",      label: "כן — התיק המלא",        sub: "כולל פרוטוקולים וחוות דעת" },
  { id: "none",      label: "לא — אין לי כלום כרגע", sub: "נעזור לך לבקש מהמוסד" },
  { id: "requested", label: "ביקשתי ולא קיבלתי",     sub: "" },
];

const TOTAL_QUIZ_SCREENS = 5;

// ── Helpers ──
function fireGa4(event, extra) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, domain: "medical", ...(extra || {}) });
}

function normalizePhone(s) { return (s || "").replace(/[\s\-()]/g, ""); }
function validateIsraeliPhone(s) {
  const n = normalizePhone(s);
  return /^(?:\+972|0)(?:5\d|[23489])\d{7}$/.test(n);
}

function computeSol(yearsAgo) {
  const remaining = SOL_YEARS - yearsAgo;
  if (remaining <= 0) return { expired: true, years: 0, months: 0, totalMonths: 0, bucket: "expired", raw: remaining };
  const totalMonths = Math.round(remaining * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const bucket = remaining <= 2 ? "warning" : "safe";
  return { expired: false, years, months, totalMonths, bucket, raw: remaining };
}

function solBanner(sol) {
  if (sol.expired) {
    return { bg: "rgba(194,59,34,0.10)", border: RED_URGENT, color: RED_URGENT, text: "חשוב לפנות מיידית — ייתכן חריג למועד גילוי דחוי" };
  }
  if (sol.bucket === "warning") {
    return { bg: AMBER_BG, border: AMBER_TEXT, color: AMBER_TEXT, text: `חלון הזמן שלך מצטמצם — נותרו ${sol.years > 0 ? `${sol.years} שנים` : `${sol.months} חודשים`}` };
  }
  return { bg: "#eef4fb", border: ACCENT, color: BLUE, text: `נותרו לך עוד ${sol.years} שנים להגיש תביעה` };
}

function buildWhatsAppText({ q1, q2, q3, q4, q5, sol }) {
  const lines = [
    "שלום, פניתי דרך האתר nifgati לגבי רשלנות רפואית.",
    `סוג מקרה: ${q1.label}`,
    `מתי: ${q2.label}`,
    `הסבר סיכונים: ${q3.label}`,
    `השפעה היום: ${q4.label}`,
    `תיעוד: ${q5.label}`,
  ];
  if (!sol.expired) {
    lines.push(`נותרו כ-${sol.years} שנים, ${sol.months} חודשים להגשת תביעה.`);
  } else {
    lines.push("(התאונה ישנה מ-7 שנים — יש לברר חריג למועד גילוי דחוי.)");
  }
  lines.push("אשמח לתאם שיחה קצרה.");
  return lines.join("\n");
}

async function postCrm(payload) {
  try {
    const res = await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, gclid: getGclid() }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: !data.crmError };
  } catch { return { ok: false }; }
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
export default function MedicalBot() {
  const [screen, setScreen] = useState(1);
  const [q1, setQ1] = useState(null);
  const [q2, setQ2] = useState(null);
  const [q3, setQ3] = useState(null);
  const [q4, setQ4] = useState(null);
  const [q5, setQ5] = useState(null);

  const [formName, setFormName]   = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formTime, setFormTime]   = useState("");
  const [waOptIn, setWaOptIn]     = useState(true);
  const [consent, setConsent]     = useState(true);
  const [nameErr, setNameErr]     = useState("");
  const [phoneErr, setPhoneErr]   = useState("");
  const [consentErr, setConsentErr] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErr, setFormErr]     = useState(false);
  const [fastLoading, setFastLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth <= 768
  );

  const startRef  = useRef(false);
  const resultRef = useRef(false);
  const formRef   = useRef(false);

  // Mount: GCLID + fire quiz_start once (StrictMode-safe)
  useEffect(() => {
    captureGclid();
    if (!startRef.current) { startRef.current = true; fireGa4("medical_quiz_start"); }
  }, []);

  // Resize listener
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Derived SOL
  const sol = q2 ? computeSol(q2.yearsAgo) : null;

  // Result-shown event (screen 6, once)
  useEffect(() => {
    if (screen === 6 && !resultRef.current && q2 && q4) {
      resultRef.current = true;
      fireGa4("medical_quiz_result_shown", {
        when_bucket: q2.id,
        damage_type: q4.id,
        sol_bucket: sol?.bucket || "unknown",
      });
    }
    if (screen === 7 && !formRef.current) {
      formRef.current = true;
      fireGa4("medical_quiz_form_shown");
    }
  }, [screen, q2, q4, sol]);

  // ── Answer handlers ──
  function pickQ1(opt) {
    setQ1(opt);
    fireGa4("medical_quiz_q1_answered", { case_type: opt.id });
    setScreen(2);
  }
  function pickQ2(opt) {
    setQ2(opt);
    const s = computeSol(opt.yearsAgo);
    fireGa4("medical_quiz_q2_answered", { when_bucket: opt.id, sol_remaining_years: s.expired ? 0 : +(s.totalMonths / 12).toFixed(1) });
  }
  function pickQ3(opt) {
    setQ3(opt);
    fireGa4("medical_quiz_q3_answered", { disclosure_level: opt.id });
  }
  function pickQ4(opt) {
    setQ4(opt);
    fireGa4("medical_quiz_q4_answered", { damage_type: opt.id });
  }
  function pickQ5(opt) {
    setQ5(opt);
    fireGa4("medical_quiz_q5_answered", { docs_status: opt.id });
  }

  function goBack() {
    if (screen > 1) setScreen(s => s - 1);
  }

  // ── CTAs on results screen ──
  async function openWhatsAppFast() {
    if (fastLoading) return;
    setFastLoading(true);
    fireGa4("medical_quiz_whatsapp_fast");
    // fire-and-forget partial CRM write
    postCrm({
      domain: "medical",
      case_type: q1.label,
      free_text: "",
      detected_categories: [],
      sol_remaining_months: sol?.expired ? 0 : sol?.totalMonths,
      sol_bucket: sol?.bucket || "",
      has_permanent_damage: q4?.id === "permanent" ? "כן" : (q4?.id === "early" ? "לא בטוח" : "לא"),
      has_medical_records: q5?.id === "full" ? "כן" : (q5?.id === "partial" ? "חלקית" : "לא"),
      user_agent: navigator.userAgent,
      disclosure_level: q3?.id,
      damage_type: q4?.id,
      documentation_status: q5?.id,
      sol_years_remaining: sol?.expired ? 0 : +(sol.totalMonths / 12).toFixed(2),
      submission_type: "whatsapp_fast",
    });
    const text = buildWhatsAppText({ q1, q2, q3, q4, q5, sol });
    window.open(`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setTimeout(() => setFastLoading(false), 600);
  }

  // ── Form submit ──
  async function submitForm(e) {
    e?.preventDefault?.();
    if (formSubmitting) return;

    let hasErr = false;
    if (!formName.trim()) { setNameErr("אנא הזן שם מלא"); hasErr = true; } else setNameErr("");
    if (!validateIsraeliPhone(formPhone)) { setPhoneErr("אנא הזן מספר טלפון ישראלי תקין"); hasErr = true; } else setPhoneErr("");
    if (!consent) { setConsentErr("נדרש אישור תקנון ומדיניות פרטיות"); hasErr = true; } else setConsentErr("");
    if (hasErr) return;

    setFormSubmitting(true);
    setFormErr(false);

    const payload = {
      domain: "medical",
      name: formName.trim(),
      phone: normalizePhone(formPhone),
      case_type: q1.label,
      free_text: formTime.trim(),  // repurpose: preferred callback time
      detected_categories: [],
      sol_remaining_months: sol?.expired ? 0 : sol?.totalMonths,
      sol_bucket: sol?.bucket || "",
      has_permanent_damage: q4?.id === "permanent" ? "כן" : (q4?.id === "early" ? "לא בטוח" : "לא"),
      has_medical_records: q5?.id === "full" ? "כן" : (q5?.id === "partial" ? "חלקית" : "לא"),
      user_agent: navigator.userAgent,
      disclosure_level: q3?.id,
      damage_type: q4?.id,
      documentation_status: q5?.id,
      sol_years_remaining: sol?.expired ? 0 : +(sol.totalMonths / 12).toFixed(2),
      submission_type: "form",
    };

    const { ok } = await postCrm(payload);
    setFormSubmitting(false);
    if (ok) {
      fireGa4("medical_quiz_lead_captured", { wa_opt_in: waOptIn });
      setScreen(8);
    } else {
      setFormErr(true);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────
  const card = {
    background: "#ffffff",
    border: "1px solid #dde3ea",
    borderRadius: isMobile ? 0 : 18,
    boxShadow: "0 8px 28px rgba(10,34,64,0.10)",
    maxWidth: 720,
    width: "100%",
    margin: "0 auto",
    overflow: "hidden",
    direction: "rtl",
    fontFamily: "'Heebo',Arial,sans-serif",
    color: G,
    display: "flex",
    flexDirection: "column",
    minHeight: isMobile ? "100vh" : 620,
  };

  const header = {
    background: G,
    color: "#ffffff",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const body = {
    padding: isMobile ? "24px 18px" : "32px 36px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const kicker    = { fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase" };
  const headline  = { fontSize: isMobile ? 22 : 26, fontWeight: 900, color: G, lineHeight: 1.25 };
  const subhead   = { fontSize: 14, color: "#5a6a7a", lineHeight: 1.7 };
  const footerStrip = { padding: "10px 16px", background: "#f5f7fa", borderTop: "1px solid #dde3ea", fontSize: 11, color: "#7a8fa5", textAlign: "center" };

  const pillBtn = (active) => ({
    width: "100%",
    minHeight: 56,
    textAlign: "right",
    background: active ? `${G}0f` : "#ffffff",
    color: G,
    border: `1.5px solid ${active ? G : G + "33"}`,
    borderRadius: 14,
    padding: "14px 18px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all .15s",
    direction: "rtl",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 4,
  });

  const pillLabel = { fontSize: 15, fontWeight: 800, color: G, textAlign: "right" };
  const pillSub   = { fontSize: 12, fontWeight: 500, color: "#5a6a7a", textAlign: "right" };

  const primaryBtn = {
    background: G, color: "#ffffff", border: "none", borderRadius: 12,
    padding: "14px 22px", fontSize: 16, fontWeight: 800, fontFamily: "inherit",
    cursor: "pointer", minHeight: 48,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  };
  const primaryDisabled = { ...primaryBtn, opacity: .55, cursor: "not-allowed" };

  const waBtnStyle = { ...primaryBtn, background: WA_GREEN, width: "100%" };
  const ghostBtn = {
    background: "transparent", color: G, border: `1.5px solid ${G}66`, borderRadius: 12,
    padding: "13px 20px", fontSize: 15, fontWeight: 700, fontFamily: "inherit",
    cursor: "pointer", minHeight: 48, width: "100%",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  };

  const input = {
    width: "100%", background: "#f8f9fb", border: "1px solid #dde3ea",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, fontFamily: "inherit",
    color: G, direction: "rtl", boxSizing: "border-box", minHeight: 48,
  };

  const label = { fontSize: 14, fontWeight: 700, color: G, display: "block", marginBottom: 6 };

  const warnStrip = (kind) => ({
    background: kind === "amber" ? AMBER_BG : kind === "green" ? GREEN_BG : "rgba(194,59,34,0.10)",
    color:      kind === "amber" ? AMBER_TEXT : kind === "green" ? GREEN_TEXT : RED_URGENT,
    border: `1px solid ${kind === "amber" ? AMBER_TEXT : kind === "green" ? GREEN_TEXT : RED_URGENT}55`,
    padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, lineHeight: 1.6,
  });

  const summaryRow = {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "10px 0", borderBottom: "1px solid #eef1f5", gap: 12, fontSize: 14,
  };

  const solCard = {
    background: G, color: "#ffffff", borderRadius: 14, padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: 6,
  };

  const nextStep = {
    background: "#f8f9fb", borderRight: `4px solid ${G}`, padding: "14px 16px",
    borderRadius: 10, fontSize: 14, lineHeight: 1.7, color: G, fontWeight: 600,
  };

  const trustBadge = {
    flex: 1, textAlign: "center", padding: "10px 6px", background: "#f8f9fb",
    border: "1px solid #dde3ea", borderRadius: 10, fontSize: 12, fontWeight: 700, color: G,
  };

  const firstName = (formName || "").trim().split(/\s+/)[0] || "";

  const showBack = screen >= 2 && screen <= 6;
  const showProgress = screen <= 5;

  // Stronger headline condition
  const strongHeadline = q3?.flag === "autonomy-severe" && q4?.id === "permanent";

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div style={card}>
      <style>{`
        @keyframes mb_fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mb-screen { animation: mb_fadeUp 200ms ease-out; }
        .mb-pill:hover:not(:disabled) { border-color: ${G} !important; background: ${G}08 !important; }
        .mb-dot { width: 8px; height: 8px; border-radius: 50%; background: #ffffff33; transition: background .2s; }
        .mb-dot.active { background: ${GOLD}; }
        .mb-dot.current { background: #ffffff; box-shadow: 0 0 0 3px ${GOLD}55; }
      `}</style>

      {/* Header */}
      <div style={header}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>🩺 nifgati — רשלנות רפואית</span>
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="חזור"
            style={{ background: "transparent", border: `1px solid #ffffff44`, color: "#ffffff", borderRadius: 8, width: 36, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "inherit", padding: 0 }}
          >
            →
          </button>
        ) : (
          <span aria-hidden="true" style={{ width: 36, height: 32 }} />
        )}
      </div>

      {/* Progress dots */}
      {showProgress && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "12px 18px 0", direction: "ltr" }}>
          {Array.from({ length: TOTAL_QUIZ_SCREENS }).map((_, i) => {
            const idx = i + 1;
            const cls = idx < screen ? "mb-dot active" : idx === screen ? "mb-dot current" : "mb-dot";
            return <span key={i} className={cls} aria-hidden="true" />;
          })}
        </div>
      )}

      {/* Body */}
      <div key={screen} className="mb-screen" style={body}>

        {/* ── Screen 1: Case Type ── */}
        {screen === 1 && (
          <>
            <div style={kicker}>שאלה 1 מתוך {TOTAL_QUIZ_SCREENS}</div>
            <h1 style={headline}>מה קרה?</h1>
            <p style={subhead}>בחר את סוג המקרה שהכי מתאים.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {Q1_OPTIONS.map(opt => (
                <button key={opt.id} className="mb-pill" onClick={() => pickQ1(opt)} style={pillBtn(q1?.id === opt.id)}>
                  <span style={pillLabel}>{opt.label}</span>
                  {opt.sub && <span style={pillSub}>{opt.sub}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Screen 2: When ── */}
        {screen === 2 && (
          <>
            <div style={kicker}>שאלה 2 מתוך {TOTAL_QUIZ_SCREENS}</div>
            <h1 style={headline}>מתי זה קרה?</h1>
            <p style={subhead}>בערך. מיועד לחישוב חלון הזמן להגשת תביעה.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Q2_OPTIONS.map(opt => (
                <button key={opt.id} className="mb-pill" onClick={() => pickQ2(opt)} style={pillBtn(q2?.id === opt.id)}>
                  <span style={pillLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
            {q2 && sol && (() => {
              const b = solBanner(sol);
              return <div style={{ ...warnStrip(sol.expired ? "red" : sol.bucket === "warning" ? "amber" : "green"), background: b.bg, color: b.color, border: `1px solid ${b.border}55` }}>{b.text}</div>;
            })()}
            {q2 && (
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-start" }}>
                <button onClick={() => setScreen(3)} style={primaryBtn}>המשך →</button>
              </div>
            )}
          </>
        )}

        {/* ── Screen 3: Risk Disclosure ── */}
        {screen === 3 && (
          <>
            <div style={kicker}>שאלה 3 מתוך {TOTAL_QUIZ_SCREENS}</div>
            <h1 style={headline}>הוסברו לך הסיכונים לפני הטיפול?</h1>
            <p style={subhead}>הבדל גדול בין חתימה על טופס להסבר אמיתי.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Q3_OPTIONS.map(opt => (
                <button key={opt.id} className="mb-pill" onClick={() => pickQ3(opt)} style={pillBtn(q3?.id === opt.id)}>
                  <span style={pillLabel}>{opt.label}</span>
                  {opt.sub && <span style={pillSub}>{opt.sub}</span>}
                </button>
              ))}
            </div>
            {q3 && (q3.flag === "autonomy" || q3.flag === "autonomy-severe") && (
              <div style={warnStrip("amber")}>⚠ סימן אזהרה זוהה — נבדוק את זה לעומק בשיחה.</div>
            )}
            {q3 && (
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-start" }}>
                <button onClick={() => setScreen(4)} style={primaryBtn}>המשך →</button>
              </div>
            )}
          </>
        )}

        {/* ── Screen 4: Damage / Impact ── */}
        {screen === 4 && (
          <>
            <div style={kicker}>שאלה 4 מתוך {TOTAL_QUIZ_SCREENS}</div>
            <h1 style={headline}>איך הטיפול השפיע על החיים שלך היום?</h1>
            <p style={subhead}>בחר מה שהכי נכון עבורך.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Q4_OPTIONS.map(opt => (
                <button key={opt.id} className="mb-pill" onClick={() => pickQ4(opt)} style={pillBtn(q4?.id === opt.id)}>
                  <span style={{ ...pillLabel, display: "flex", alignItems: "center", gap: 10 }}>
                    <span aria-hidden="true">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </span>
                </button>
              ))}
            </div>
            {q4 && (
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-start" }}>
                <button onClick={() => setScreen(5)} style={primaryBtn}>המשך →</button>
              </div>
            )}
          </>
        )}

        {/* ── Screen 5: Documentation ── */}
        {screen === 5 && (
          <>
            <div style={kicker}>שאלה 5 מתוך {TOTAL_QUIZ_SCREENS}</div>
            <h1 style={headline}>יש בידיך מסמכים מהטיפול?</h1>
            <p style={subhead}>אין בעיה אם לא — נעזור לך להשיג אותם.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Q5_OPTIONS.map(opt => (
                <button key={opt.id} className="mb-pill" onClick={() => pickQ5(opt)} style={pillBtn(q5?.id === opt.id)}>
                  <span style={pillLabel}>{opt.label}</span>
                  {opt.sub && <span style={pillSub}>{opt.sub}</span>}
                </button>
              ))}
            </div>
            {q5 && <div style={warnStrip("green")}>✓ כמעט סיימנו. בדקנו את הסימנים שלך.</div>}
            {q5 && (
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-start" }}>
                <button onClick={() => setScreen(6)} style={primaryBtn}>ראה תוצאה →</button>
              </div>
            )}
          </>
        )}

        {/* ── Screen 6: Results ── */}
        {screen === 6 && q1 && q2 && q3 && q4 && q5 && sol && (
          <>
            <div style={kicker}>בדיקת זכאות הושלמה</div>
            <h1 style={headline}>
              {strongHeadline
                ? "המקרה שלך מצריך בדיקה מיידית."
                : "המקרה שלך נשמע משמעותי. כדאי לדבר עם עו״ד."}
            </h1>

            <div style={{ background: "#f8f9fb", border: "1px solid #dde3ea", borderRadius: 12, padding: "6px 16px" }}>
              <div style={summaryRow}><span style={{ color: "#5a6a7a" }}>סוג מקרה</span><span style={{ fontWeight: 700 }}>{q1.label}</span></div>
              <div style={summaryRow}><span style={{ color: "#5a6a7a" }}>מתי</span><span style={{ fontWeight: 700 }}>{q2.label}</span></div>
              <div style={summaryRow}><span style={{ color: "#5a6a7a" }}>הסבר סיכונים</span><span style={{ fontWeight: 700 }}>{q3.label}</span></div>
              <div style={summaryRow}><span style={{ color: "#5a6a7a" }}>השפעה היום</span><span style={{ fontWeight: 700 }}>{q4.label}</span></div>
              <div style={{ ...summaryRow, borderBottom: "none" }}><span style={{ color: "#5a6a7a" }}>תיעוד</span><span style={{ fontWeight: 700 }}>{q5.label}</span></div>
            </div>

            <div style={solCard}>
              <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase" }}>תקופת התיישנות</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {sol.expired
                  ? "ייתכן שעברה תקופת ההתיישנות — נבדוק חריג למועד גילוי דחוי"
                  : `נותרו ${sol.years} שנים, ${sol.months} חודשים להגיש תביעה`}
              </div>
            </div>

            <div style={nextStep}>
              הצעד הבא: שיחת 15 דקות עם עו״ד דן אלון, חינם, ללא התחייבות.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              <button onClick={openWhatsAppFast} disabled={fastLoading} style={fastLoading ? { ...waBtnStyle, opacity: .7, cursor: "wait" } : waBtnStyle}>
                <span aria-hidden="true">💬</span>
                <span>{fastLoading ? "פותח וואטסאפ..." : "קבע שיחה — חינם"}</span>
              </button>
              <button onClick={() => setScreen(7)} style={ghostBtn}>השאר פרטים ונחזור אליך</button>
            </div>
          </>
        )}

        {/* ── Screen 7: Contact Form ── */}
        {screen === 7 && (
          <>
            <div style={kicker}>פרטי יצירת קשר</div>
            <h1 style={headline}>איך נגיע אליך?</h1>
            <p style={subhead}>נחזור אליך תוך 2 שעות בשעות הפעילות.</p>

            <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={label} htmlFor="mb-name">שם מלא</label>
                <input id="mb-name" value={formName} onChange={e => { setFormName(e.target.value); if (nameErr) setNameErr(""); }} style={input} autoComplete="name" required />
                {nameErr && <div style={{ color: RED_URGENT, fontSize: 12, marginTop: 4 }}>{nameErr}</div>}
              </div>

              <div>
                <label style={label} htmlFor="mb-phone">מספר טלפון</label>
                <input id="mb-phone" type="tel" value={formPhone} onChange={e => { setFormPhone(e.target.value); if (phoneErr) setPhoneErr(""); }} style={input} autoComplete="tel" placeholder="05X-XXXXXXX" required />
                {phoneErr && <div style={{ color: RED_URGENT, fontSize: 12, marginTop: 4 }}>{phoneErr}</div>}
              </div>

              <div>
                <label style={label} htmlFor="mb-time">זמן מועדף לחזרה (אופציונלי)</label>
                <input id="mb-time" value={formTime} onChange={e => setFormTime(e.target.value)} style={input} placeholder="למשל — היום אחה״צ" />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: G, cursor: "pointer" }}>
                <input type="checkbox" checked={waOptIn} onChange={e => setWaOptIn(e.target.checked)} style={{ width: 18, height: 18, accentColor: G }} />
                <span>העדפתי לקבל עדכון בוואטסאפ</span>
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#5a6a7a", cursor: "pointer", lineHeight: 1.6 }}>
                <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); if (consentErr) setConsentErr(""); }} style={{ width: 18, height: 18, accentColor: G, marginTop: 2 }} />
                <span>קראתי את תקנון השירות ומדיניות הפרטיות</span>
              </label>
              {consentErr && <div style={{ color: RED_URGENT, fontSize: 12 }}>{consentErr}</div>}

              {formErr && (
                <div style={warnStrip("red")}>
                  אירעה תקלה בשליחה. אפשר לפנות ישירות בוואטסאפ:
                  <button type="button" onClick={openWhatsAppFast} style={{ ...waBtnStyle, marginTop: 10 }}>💬 לשליחה מהירה</button>
                </div>
              )}

              <button type="submit" disabled={formSubmitting} style={formSubmitting ? primaryDisabled : primaryBtn}>
                {formSubmitting ? "שולח..." : "שלח — תוך 2 שעות חוזרים"}
              </button>

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <span style={trustBadge}>25 שנות ניסיון</span>
                <span style={trustBadge}>1,800+ תיקים</span>
                <span style={trustBadge}>4.9★ Google</span>
              </div>
            </form>
          </>
        )}

        {/* ── Screen 8: Thank You ── */}
        {screen === 8 && (
          <div style={{
            background: `linear-gradient(160deg, ${G} 0%, ${BLUE} 100%)`,
            color: "#ffffff",
            margin: isMobile ? "-24px -18px -10px" : "-32px -36px -10px",
            padding: isMobile ? "40px 22px" : "48px 36px",
            minHeight: "100%",
            display: "flex", flexDirection: "column", gap: 20,
            borderRadius: isMobile ? 0 : "0 0 18px 18px",
            flex: 1,
          }}>
            <div style={{ width: 66, height: 66, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: 32, color: G, fontWeight: 900 }} aria-hidden="true">✓</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>הפנייה התקבלה</div>
              <h1 style={{ fontSize: isMobile ? 26 : 30, fontWeight: 900, lineHeight: 1.25, color: "#ffffff" }}>
                תודה{firstName ? `, ${firstName}` : ""}.
              </h1>
            </div>
            <p style={{ textAlign: "center", fontSize: 15, lineHeight: 1.7, color: "#ffffffcc" }}>
              עו״ד דן אלון יחזור אליך תוך 2 שעות בוואטסאפ.
            </p>

            <div style={{ background: "#ffffff10", border: "1px solid #ffffff22", borderRadius: 14, padding: "16px 18px", marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>מה קורה עכשיו</div>
              <ol style={{ paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 10, color: "#ffffffdd", fontSize: 14, lineHeight: 1.7 }}>
                <li>סקירה של הסיכום שהכנת — ללא התחייבות</li>
                <li>שיחת 15 דקות — אם יש עילה, נסביר איך ממשיכים</li>
                <li>החלטה שלך — לגמרי חופשית</li>
              </ol>
            </div>
          </div>
        )}

      </div>

      <div style={footerStrip}>השיחה לא נשמרת בשרתים • המידע אינו מהווה ייעוץ משפטי</div>
    </div>
  );
}
