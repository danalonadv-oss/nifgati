import { useState } from "react";
import LandingPage from "../LandingPage.jsx";

const G = "#c9a84c";

function getUtmTerm() {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get("utm_term");
  if (!raw) return "";
  return decodeURIComponent(raw.replace(/\+/g, " ")).trim().toLowerCase();
}

function getDynamicTitle() {
  const t = getUtmTerm();
  if (t.includes('דוגמאות') && t.includes('פיצויים'))
    return 'דוגמאות לפיצויים בתאונות דרכים — ראה כמה קיבלו לקוחותינו';
  if (t.includes('תביעת נזקי גוף') || t.includes('נזקי גוף'))
    return 'תביעת נזקי גוף בתאונת דרכים — בדוק כמה מגיע לך';
  if (t.includes('עורך דין'))
    return 'עורך דין תאונות דרכים — ייעוץ ראשוני חינמי';
  if (t.includes('נפגעתי'))
    return 'נפגעת בתאונת דרכים? גלה כמה מגיע לך — חינם';
  if (t.includes('מה עושים') || t.includes('מה לעשות'))
    return 'מה עושים אחרי תאונת דרכים — המדריך המלא';
  if (t.includes('ביטוח חובה'))
    return 'תביעת ביטוח חובה לאחר תאונה — בדוק זכאות';
  if (t.includes('פיצוי') || t.includes('פיצויים'))
    return 'פיצויים בתאונת דרכים — גלה כמה מגיע לך';
  if (t.includes('תביעה'))
    return 'תביעת תאונת דרכים — בדוק זכאות חינם';
  return 'נפגעת בתאונת דרכים? בדוק כמה פיצוי מגיע לך';
}

function getDynamicSubtitle() {
  const t = getUtmTerm();
  if (t.includes('דוגמאות') || t.includes('כמה מקבלים'))
    return 'תוצאות אמיתיות של לקוחות עו״ד דן אלון — גלה כמה מגיע גם לך';
  if (t.includes('מחשבון') || t.includes('חישוב'))
    return 'מחשבון חינמי לפי נוסחת פלת״ד — כאב וסבל, הפסד שכר, נכות';
  if (t.includes('עורך דין') || t.includes('עו"ד'))
    return '25 שנות ניסיון בנזיקין | שכ״ט רק מהפיצוי | ייעוץ חינם';
  return 'גלה כמה מגיע לך — תוך 60 שניות, חינם, אנונימי';
}

const caseResults = [
  { emoji: "🚗", type: "תאונת רכב", disability: "נכות 15%", amount: "₪320,000", detail: "נהג בן 35, פגיעה בגב תחתון" },
  { emoji: "🏍️", type: "תאונת אופנוע", disability: "נכות 25%", amount: "₪680,000", detail: "רוכב בן 28, שבר ביד ובכתף" },
  { emoji: "🚶", type: "הולך רגל", disability: "נכות 10%", amount: "₪185,000", detail: "הולכת רגל בת 52, פגיעה בברך" },
];

const faqItems = [
  { q: "כמה פיצוי מגיע על תאונת דרכים?", a: "הפיצוי תלוי באחוז הנכות, ימי אשפוז, גיל והפסד שכר. טווח רגיל: ₪50,000 עד ₪1,500,000." },
  { q: "מה עושים אחרי תאונת דרכים?", a: "1. פנו לטיפול רפואי 2. צלמו את הזירה 3. רשמו פרטי נהגים 4. פנו לעורך דין לבדיקת זכאות." },
  { q: "האם צריך להוכיח אשמה בתאונת דרכים?", a: "לא. לפי חוק הפלת״ד, האחריות מוחלטת — הפיצוי מגיע ללא קשר לשאלת האשם." },
  { q: "כמה זמן לוקחת תביעת תאונת דרכים?", a: "תביעת פלת״ד מתיישנת תוך 7 שנים. תביעה רגילה נמשכת 6-18 חודשים." },
  { q: "כמה עולה עורך דין תאונות דרכים?", a: "שכר טרחה של 8%-13% מהפיצוי, רק אם מצליחים. ללא עלות מקדימה." },
];

const statsExamples = [
  { emoji: "🚗", detail: "נכות 15% | גיל 35", amount: "₪320,000" },
  { emoji: "🏍️", detail: "נכות 25% | גיל 28", amount: "₪680,000" },
  { emoji: "🚶", detail: "נכות 10% | גיל 52", amount: "₪185,000" },
];

const cardStyle = {
  background: "rgba(184,149,58,0.15)",
  border: "1px solid rgba(184,149,58,0.4)",
  borderRadius: "12px",
  padding: "12px 16px",
  textAlign: "center",
  minWidth: "140px",
};

function StatsRow() {
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", margin: "16px 0", direction: "rtl" }}>
      {statsExamples.map((s, i) => (
        <div key={i} style={cardStyle}>
          <div style={{ fontSize: "13px", color: "#aaa" }}>{s.emoji} {s.detail}</div>
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#b8953a" }}>{s.amount}</div>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #1e2d4a" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", background: "none", border: "none", color: "#e8e0d0", fontFamily: "inherit", fontSize: 16, fontWeight: 700, padding: "18px 0", cursor: "pointer", textAlign: "right", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
      >
        <span>{q}</span>
        <span style={{ color: G, fontSize: 20, flexShrink: 0 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <p style={{ color: "#7a8fa5", fontSize: 15, lineHeight: 1.8, margin: 0, padding: "0 0 18px" }}>{a}</p>
      )}
    </div>
  );
}

function ExtraContent() {
  return (
    <>
      {/* ── CASE RESULTS ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0", direction: "rtl" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 28, color: "#e8e0d0" }}>דוגמאות לפיצויים בתאונות דרכים</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {caseResults.map((c, i) => (
            <div key={i} style={{ background: "#0d1323", border: "1px solid #1e2d4a", borderRadius: 14, padding: "20px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 14, color: "#7a8fa5" }}>{c.emoji} {c.type}</span>
              <span style={{ fontSize: 14, color: "#7a8fa5" }}>{c.disability}</span>
              <strong style={{ fontSize: 28, fontWeight: 700, color: G }}>{c.amount}</strong>
              <span style={{ fontSize: 13, color: "#7a8fa5" }}>{c.detail}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#556070", textAlign: "center", marginTop: 12 }}>*הסכומים להמחשה בלבד. כל מקרה נבחן באופן אישי.</p>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "56px 0 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 28, color: "#e8e0d0" }}>שאלות נפוצות — תאונות דרכים ופיצויים</h2>
        <div>
          {faqItems.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ── SEO TEXT ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0" }}>
        <p style={{ fontSize: 12, color: "#556070", lineHeight: 2, textAlign: "center" }}>
          מחשבון פיצויים לתאונת דרכים | חישוב כאב וסבל לפי פלת״ד | תביעת נזקי גוף | דוגמאות לפיצויים בתאונות דרכים | עורך דין תאונות דרכים | ביטוח חובה | הפסד שכר | נכות מתאונה
        </p>
      </section>
    </>
  );
}

export default function TaonatDrakhim() {
  const [title] = useState(getDynamicTitle);
  const [subtitle] = useState(getDynamicSubtitle);

  return <LandingPage
    pageTitle={title}
    pageSubtitle={subtitle}
    metaTitle={title + " | נפגעתי"}
    metaDescription="דוגמאות אמיתיות לפיצויים בתאונות דרכים — ₪185,000 עד ₪680,000. חשב כמה מגיע לך חינם תוך 60 שניות."
    heroEmoji="🚗"
    bullets={["הנתונים לא נשמרים ולא מתועדים","אנונימי לחלוטין — השיחה לא נשמרת","ייצוג מלא מול חברות הביטוח"]}
    ctaText="חשב פיצוי על תאונת דרכים"
    pageSlug="taonat-drakhim"
    socialProofLabel="נכות 15% — תאונת דרכים"
    bannerText="תאונת דרכים — חשב ודע מיד כמה מגיע לך"
    heroExtra={<StatsRow />}
    extraContent={<ExtraContent />}
  />;
}
