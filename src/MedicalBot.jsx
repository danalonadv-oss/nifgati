import { useState, useEffect } from "react";
import { captureGclid, getGclid } from "./utils/gclid.js";
import { MEDICAL_CATEGORIES } from "./constants/medicalSystemPrompt.js";

const CASE_TYPES = [
  "ניתוח או פעולה פולשנית",
  "אבחון - איחור או טעות באבחון",
  "לידה - פגיעה באם או ביילוד",
  "תרופות ומינונים",
  "אחר / לא בטוח",
];

const PERM_DAMAGE_OPTIONS = ["כן", "לא", "לא בטוח"];
const RECORDS_OPTIONS = ["כן, הכל", "חלקי", "לא"];
const INSTITUTION_OPTIONS = ["בית חולים ציבורי", "קופת חולים", "בית חולים פרטי", "קליניקה פרטית", "לא יודע"];

const WA_BASE = "https://wa.me/972544338212";

function fireGa4(event, extra = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, domain: "medical", ...extra });
}

function normalizePhone(s) { return (s || "").replace(/[\s\-()]/g, ""); }
function validateIsraeliPhone(s) {
  const n = normalizePhone(s);
  return /^(?:\+972|0)5\d{8}$/.test(n);
}

function formatDateHe(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function calcSol(incidentISO, discoveryISO) {
  if (!incidentISO) return null;
  // Ignore discovery date if it's before the incident (illogical)
  const effectiveDiscovery = (discoveryISO && discoveryISO >= incidentISO) ? discoveryISO : null;
  const start = new Date(effectiveDiscovery || incidentISO);
  if (isNaN(start.getTime())) return null;
  const deadline = new Date(start.getFullYear() + 7, start.getMonth(), start.getDate());
  const now = new Date();
  const diffMs = deadline - now;
  const totalMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
  if (diffMs < 0) return { years: 0, months: 0, totalMonths, bucket: "expired" };
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const bucket = years > 6 ? "far" : "near";
  return { years, months, totalMonths, bucket };
}

function solMessage(sol) {
  if (!sol) return "";
  if (sol.bucket === "expired") {
    return "לפי התאריכים שהזנת, ייתכן שעברה תקופת ההתיישנות בת 7 השנים. קיימים חריגים (קטינים, גילוי מאוחר של נזק וכו') - מומלץ בכל זאת להתייעץ.";
  }
  if (sol.bucket === "far") {
    return `יש לך עדיין זמן רב (${sol.years} שנים) עד תום תקופת ההתיישנות. מומלץ להתחיל בבדיקה מוקדם ככל האפשר - איסוף תיעוד קל יותר סמוך למועד האירוע.`;
  }
  return `נותרו כ-${sol.years} שנים ו-${sol.months} חודשים עד תום תקופת ההתיישנות בת 7 השנים. מומלץ לא לדחות את הבדיקה.`;
}

async function postToClaude(caseType, freeText) {
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "medical",
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "user", content: `Case type: ${caseType}\nDescription: ${freeText}` }],
      }),
    });
    if (!res.ok) return { ok: false, categories: [] };
    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return { ok: true, categories: [] };
    let parsed;
    try { parsed = JSON.parse(match[0]); } catch { return { ok: true, categories: [] }; }
    if (!Array.isArray(parsed)) return { ok: true, categories: [] };
    const filtered = parsed
      .filter(c => typeof c === "string" && MEDICAL_CATEGORIES.includes(c))
      .slice(0, 4);
    return { ok: true, categories: filtered };
  } catch {
    return { ok: false, categories: [] };
  }
}

async function postToCrm(payload) {
  try {
    const res = await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, gclid: getGclid() }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: !data.crmError };
  } catch {
    return { ok: false };
  }
}

function buildWhatsAppText({ caseType, incidentDate, detectedCount }) {
  const dateStr = formatDateHe(incidentDate);
  const detectedLine = detectedCount === 0
    ? "הבדיקה הראשונית לא הציפה סוגיה בולטת, אך אשמח בכל זאת להתייעצות."
    : `בבדיקה הראשונית עלו ${detectedCount} סוגיות לבחינה מעמיקה.`;
  const dateLine = dateStr ? `תאריך האירוע: ${dateStr}\n` : "";
  return `שלום, פניתי דרך אתר נפגעתי לגבי בדיקת זכאות לרשלנות רפואית.
סוג מקרה: ${caseType || "לא צוין"}
${dateLine}${detectedLine}
אשמח שתחזרו אליי.`;
}

export default function MedicalBot() {
  const [step, setStep] = useState(1);
  const [caseType, setCaseType] = useState("");
  const [freeText, setFreeText] = useState("");
  const [freeTextErr, setFreeTextErr] = useState("");
  const [detectedCategories, setDetectedCategories] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiErrored, setApiErrored] = useState(false);
  const [incidentDate, setIncidentDate] = useState("");
  const [discoveryDate, setDiscoveryDate] = useState("");
  const [sol, setSol] = useState(null);
  const [solShown, setSolShown] = useState(false);
  const [permanentDamage, setPermanentDamage] = useState("");
  const [hasRecords, setHasRecords] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadErr, setLeadErr] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 768);

  useEffect(() => { captureGclid(); fireGa4("medical_bot_shown"); }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleCaseType(t) {
    setCaseType(t);
    fireGa4("medical_bot_step_1_complete", { case_type: t });
    setStep(2);
  }

  async function submitFreeText() {
    const t = freeText.trim();
    if (t.length < 30) { setFreeTextErr("אנא הוסף לפחות כמה משפטים על מה שקרה"); return; }
    setFreeTextErr("");
    setApiLoading(true);
    setApiErrored(false);
    const { ok, categories } = await postToClaude(caseType, t);
    setApiLoading(false);
    if (!ok) setApiErrored(true);
    setDetectedCategories(categories);
    fireGa4("medical_bot_step_2_complete", { detected_count: categories.length, api_ok: ok });
    setStep(3);
  }

  function calcSolNow() {
    if (!incidentDate) return;
    setSol(calcSol(incidentDate, discoveryDate));
    setSolShown(true);
  }
  function continueFromSol() {
    fireGa4("medical_bot_step_3_complete", { sol_bucket: sol?.bucket || "unknown" });
    setStep(4);
  }

  function submitElig() {
    if (!permanentDamage || !hasRecords || !institutionType) return;
    fireGa4("medical_bot_step_4_complete");
    setStep(5);
  }

  async function submitLead(e) {
    e?.preventDefault?.();
    if (leadSubmitting || leadSubmitted) return;
    if (!leadName.trim()) return;
    if (!validateIsraeliPhone(leadPhone)) { setPhoneErr("אנא הזן מספר טלפון ישראלי תקין"); return; }
    setPhoneErr("");
    setLeadSubmitting(true);
    setLeadErr(false);
    const payload = {
      domain: "medical",
      name: leadName.trim(),
      phone: normalizePhone(leadPhone),
      case_type: caseType,
      free_text: freeText.trim(),
      detected_categories: detectedCategories,
      incident_date: incidentDate,
      discovery_date: discoveryDate,
      sol_remaining_months: sol?.totalMonths ?? null,
      sol_bucket: sol?.bucket || "",
      has_permanent_damage: permanentDamage,
      has_medical_records: hasRecords,
      institution_type: institutionType,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };
    const { ok } = await postToCrm(payload);
    setLeadSubmitting(false);
    if (ok) {
      setLeadSubmitted(true);
      fireGa4("medical_bot_step_5_lead_captured");
    } else {
      setLeadErr(true);
    }
  }

  function openWhatsApp(after) {
    fireGa4("medical_bot_whatsapp_click", { after });
    const text = buildWhatsAppText({ caseType, incidentDate, detectedCount: detectedCategories.length });
    window.open(`${WA_BASE}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  const G = "#0a2240";
  const ACCENT = "#2a7ab5";
  const card = { background:"#ffffff", border:"1px solid #dde3ea", borderRadius:18, boxShadow:"0 6px 24px rgba(10,34,64,0.08)", maxWidth:680, width:"100%", margin:"0 auto", overflow:"hidden", direction:"rtl", fontFamily:"'Heebo',Arial,sans-serif", color:G };
  const headerBar = { background:G, color:"#ffffff", padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 };
  const body = { padding: isMobile ? "22px 16px" : "28px 28px", minHeight:340 };
  const stepTitle = { fontSize: isMobile ? 20 : 22, fontWeight:900, marginBottom:8, color:G };
  const subtitle = { fontSize:14, color:"#5a6a7a", lineHeight:1.7, marginBottom:20 };
  const primaryBtn = { background:G, color:"#ffffff", border:"none", borderRadius:12, padding:"14px 22px", fontSize:16, fontWeight:800, fontFamily:"inherit", cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8 };
  const primaryBtnDisabled = { ...primaryBtn, opacity:.55, cursor:"not-allowed" };
  const waBtn = { ...primaryBtn, background:"#25d366", width:"100%" };
  const choiceBtn = (active) => ({ width:"100%", textAlign:"right", background: active ? `${G}0f` : "#ffffff", color:G, border:`1.5px solid ${active ? G : G + "44"}`, borderRadius:14, padding:"14px 18px", fontSize:15, fontWeight:700, fontFamily:"inherit", cursor:"pointer", transition:"all .15s", direction:"rtl" });
  const input = { width:"100%", background:"#f8f9fb", border:"1px solid #dde3ea", borderRadius:10, padding:"12px 14px", fontSize:15, fontFamily:"inherit", color:G, direction:"rtl", boxSizing:"border-box" };
  const footerStrip = { padding:"10px 16px", background:"#f5f7fa", borderTop:"1px solid #dde3ea", fontSize:11, color:"#7a8fa5", textAlign:"center" };
  const label = { fontSize:14, fontWeight:700, color:G, display:"block", marginBottom:8 };
  const pill = { display:"inline-block", background:`${ACCENT}16`, color:ACCENT, border:`1px solid ${ACCENT}44`, borderRadius:999, padding:"6px 14px", fontSize:13, fontWeight:700, margin:"0 0 8px 8px" };
  const bannerErr = { background:"#fff4ed", border:"1px solid #f5cfb3", color:"#8a4a17", padding:"10px 14px", borderRadius:10, fontSize:13, marginBottom:16 };
  const bannerInfo = { background:"#f0f6fb", border:"1px solid #bed2e4", color:"#25466b", padding:"12px 14px", borderRadius:10, fontSize:14, lineHeight:1.75, marginBottom:16 };
  const caveat = { background:"#f5f7fa", border:"1px solid #dde3ea", color:"#5a6a7a", padding:"12px 14px", borderRadius:10, fontSize:12, lineHeight:1.7, marginTop:16 };
  const progressPct = (step / 5) * 100;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={card}>
      <div style={headerBar}>
        <span style={{ fontSize:16, fontWeight:800 }}>🩺 בדיקת זכאות - רשלנות רפואית</span>
        <span role="status" aria-live="polite" style={{ fontSize:13, fontWeight:700, color:"#ffffffcc" }}>שלב {step} מתוך 5</span>
      </div>
      <div style={{ background:"#dde3ea", height:4 }}>
        <div style={{ background:ACCENT, height:4, width:`${progressPct}%`, transition:"width .4s ease" }} />
      </div>

      <div style={body}>

        {step === 1 && (
          <div>
            <div style={stepTitle}>בדיקה ראשונית - רשלנות רפואית</div>
            <div style={subtitle}>שיחה של 2-3 דקות שתעזור לנו להבין את המקרה לפני ייעוץ טלפוני.</div>
            <div style={{ fontSize:14, color:"#2d3e52", fontWeight:600, marginBottom:14 }}>בחר את סוג המקרה שהכי מתאים למה שקרה:</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {CASE_TYPES.map(t => (
                <button key={t} onClick={() => handleCaseType(t)} aria-pressed={caseType === t} style={choiceBtn(caseType === t)}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={stepTitle}>תאר בקצרה מה קרה</div>
            <div style={subtitle}>3-5 שורות מספיקות. שמור על עובדות: תאריך, מוסד, סימפטומים, מה נעשה ומה לא נעשה.</div>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value.slice(0, 2000))}
              placeholder="לדוגמה: בחודש מרץ 2024 נותחתי בבית חולים X... לאחר הניתוח פיתחתי דלקת קשה ולא אובחנתי במשך 5 ימים..."
              rows={isMobile ? 6 : 7}
              style={{ ...input, minHeight: isMobile ? 140 : 160, resize:"vertical", lineHeight:1.7 }}
              disabled={apiLoading}
              aria-label="תיאור האירוע הרפואי"
              maxLength={2000}
            />
            {freeTextErr && <div style={{ ...bannerErr, marginTop:10, marginBottom:0 }}>{freeTextErr}</div>}
            <div style={{ fontSize:11, color:"#7a8fa5", marginTop:8, textAlign:"left" }}>{freeText.length}/2000</div>
            <div style={{ marginTop:18 }}>
              <button onClick={submitFreeText} disabled={apiLoading} style={apiLoading ? primaryBtnDisabled : primaryBtn}>
                {apiLoading ? "בודק..." : "המשך"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={stepTitle}>תקופת ההתיישנות</div>
            <div style={subtitle}>על מנת לדעת תוך כמה זמן צריך לפעול, נסמן תאריכים כלליים.</div>

            <div style={{ marginBottom:16 }}>
              <label style={label} htmlFor="incident-date">תאריך האירוע הרפואי</label>
              <input id="incident-date" type="date" value={incidentDate} max={today} onChange={e => { setIncidentDate(e.target.value); setSolShown(false); }} style={input} required />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={label} htmlFor="discovery-date">מתי גילית את הנזק? (אם שונה מתאריך האירוע)</label>
              <input id="discovery-date" type="date" value={discoveryDate} max={today} onChange={e => { setDiscoveryDate(e.target.value); setSolShown(false); }} style={input} />
              <div style={{ fontSize:12, color:"#7a8fa5", marginTop:6 }}>אופציונלי - אם לא בטוח, השאר ריק</div>
            </div>

            {solShown && sol && (
              <div style={bannerInfo}>{solMessage(sol)}</div>
            )}

            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {!solShown ? (
                <button onClick={calcSolNow} disabled={!incidentDate} style={!incidentDate ? primaryBtnDisabled : primaryBtn}>חשב</button>
              ) : (
                <button onClick={continueFromSol} style={primaryBtn}>המשך</button>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={stepTitle}>כמה שאלות קצרות</div>

            <div style={{ marginBottom:22 }}>
              <div style={label}>האם נגרם נזק קבוע, נכות או אשפוז ממושך?</div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:8 }}>
                {PERM_DAMAGE_OPTIONS.map(o => (
                  <button key={o} onClick={() => setPermanentDamage(o)} aria-pressed={permanentDamage === o} style={choiceBtn(permanentDamage === o)}>{o}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:22 }}>
              <div style={label}>האם בידיך התיעוד הרפואי של הטיפול?</div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:8 }}>
                {RECORDS_OPTIONS.map(o => (
                  <button key={o} onClick={() => setHasRecords(o)} aria-pressed={hasRecords === o} style={choiceBtn(hasRecords === o)}>{o}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:22 }}>
              <div style={label}>איזה מוסד טיפל?</div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap:8 }}>
                {INSTITUTION_OPTIONS.map(o => (
                  <button key={o} onClick={() => setInstitutionType(o)} aria-pressed={institutionType === o} style={choiceBtn(institutionType === o)}>{o}</button>
                ))}
              </div>
            </div>

            <button
              onClick={submitElig}
              disabled={!permanentDamage || !hasRecords || !institutionType}
              style={(!permanentDamage || !hasRecords || !institutionType) ? primaryBtnDisabled : primaryBtn}
            >המשך לסיכום</button>
          </div>
        )}

        {step === 5 && !leadSubmitted && (
          <div>
            <div style={stepTitle}>סיכום הבדיקה הראשונית</div>

            {detectedCategories.length > 0 ? (
              <>
                <div style={subtitle}>תודה על המידע. בהתבסס על הנתונים שמסרת, עלו {detectedCategories.length} סוגיות לבדיקה מעמיקה יותר:</div>
                <div style={{ marginBottom:14 }}>
                  {detectedCategories.map(c => <span key={c} style={pill}>{c}</span>)}
                </div>
              </>
            ) : (
              <div style={subtitle}>לא עלתה סוגיה בולטת מתוך התיאור, אך הדבר אינו שולל עילת תביעה. בדיקה מלאה של התיעוד הרפואי עם עורך דין היא הדרך היחידה לתשובה מוסמכת.</div>
            )}

            {apiErrored && (
              <div style={bannerErr}>אירעה תקלה זמנית בבדיקה האוטומטית. הפרטים שלך יועברו ויבחנו באופן ידני.</div>
            )}

            {sol && <div style={bannerInfo}>{solMessage(sol)}</div>}

            <div style={caveat}>
              הזיהוי הוא ראשוני בלבד, מבוסס על תיאור מילולי קצר. כל מקרה דורש בדיקה פרטנית של תיעוד רפואי וחוות דעת של רופא מומחה. אין במידע זה משום ייעוץ משפטי.
            </div>

            <form onSubmit={submitLead} style={{ marginTop:20 }}>
              <div style={{ fontSize:16, fontWeight:800, marginBottom:12, color:G }}>השאירו פרטים לבדיקה פרטנית ללא עלות</div>
              <div style={{ marginBottom:12 }}>
                <label style={label} htmlFor="lead-name">שם מלא</label>
                <input id="lead-name" value={leadName} onChange={e => setLeadName(e.target.value)} style={input} required autoComplete="name" />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={label} htmlFor="lead-phone">מספר טלפון</label>
                <input id="lead-phone" type="tel" value={leadPhone} onChange={e => { setLeadPhone(e.target.value); setPhoneErr(""); }} style={input} required autoComplete="tel" placeholder="05X-XXXXXXX" />
                {phoneErr && <div style={{ color:"#b23b0a", fontSize:12, marginTop:6 }}>{phoneErr}</div>}
              </div>
              {leadErr && (
                <div style={bannerErr}>
                  אירעה תקלה. באפשרותך לפנות ישירות ב-WhatsApp:
                  <div style={{ marginTop:10 }}>
                    <button type="button" onClick={() => openWhatsApp("error")} style={waBtn}>💬 לשליחה מהירה ב-WhatsApp</button>
                  </div>
                </div>
              )}
              <button type="submit" disabled={leadSubmitting} style={leadSubmitting ? primaryBtnDisabled : primaryBtn}>
                {leadSubmitting ? "שולח..." : "שלח פרטים לבדיקה"}
              </button>
            </form>
          </div>
        )}

        {step === 5 && leadSubmitted && (
          <div>
            <div style={stepTitle}>תודה! פנייתך התקבלה.</div>
            <div style={subtitle}>ניצור איתך קשר בהקדם. מעוניין בקשר מהיר יותר?</div>
            <button onClick={() => openWhatsApp("success")} style={waBtn}>💬 לשליחה מהירה ב-WhatsApp</button>
            <div style={caveat}>
              הזיהוי הוא ראשוני בלבד. כל מקרה דורש בדיקה פרטנית של תיעוד רפואי וחוות דעת של רופא מומחה.
            </div>
          </div>
        )}

      </div>

      <div style={footerStrip}>השיחה לא נשמרת בשרתים • המידע אינו מהווה ייעוץ משפטי</div>
    </div>
  );
}
