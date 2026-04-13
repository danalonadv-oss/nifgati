import { useState } from "react";
import LandingPage from "../LandingPage.jsx";

const G = "#c9a84c";

function getUtmTerm() {
  const raw = new URLSearchParams(window.location.search).get("utm_term");
  if (!raw) return "";
  return decodeURIComponent(raw.replace(/\+/g, " ")).trim().toLowerCase();
}

function getDynamicTitle() {
  const term = getUtmTerm();

  if (term.includes('דוגמאות') || term.includes('כמה מקבלים'))
    return 'דוגמאות לפיצויים בתאונות דרכים — תוצאות אמיתיות';

  if (term.includes('מחשבון') || term.includes('חישוב') || term.includes('כאב וסבל'))
    return 'מחשבון פיצויים תאונת דרכים — חשב כמה מגיע לך';

  if (term.includes('עורך דין') || term.includes('עו"ד'))
    return 'עורך דין תאונות דרכים — פיצוי מקסימלי';

  if (term.includes('פיצויים') || term.includes('פיצוי'))
    return 'פיצויים תאונת דרכים — גלה כמה מגיע לך';

  if (term.includes('תביעה'))
    return 'תביעת תאונת דרכים — בדוק את זכויותיך';

  if (term.includes('זכויות'))
    return 'זכויות נפגעי תאונות דרכים — כל המידע';

  return 'נפגעת בתאונת דרכים? מגיע לך פיצוי.';
}

function getDynamicSubtitle() {
  const term = getUtmTerm();

  if (term.includes('דוגמאות') || term.includes('כמה מקבלים'))
    return 'תוצאות אמיתיות של לקוחות עו״ד דן אלון — גלה כמה מגיע גם לך';

  if (term.includes('מחשבון') || term.includes('חישוב'))
    return 'מחשבון חינמי לפי נוסחת פלת״ד — כאב וסבל, הפסד שכר, נכות';

  if (term.includes('עורך דין') || term.includes('עו"ד'))
    return '25 שנות ניסיון בנזיקין | שכ״ט רק מהפיצוי | ייעוץ חינם';

  return 'גלה כמה מגיע לך — תוך 60 שניות, חינם, אנונימי';
}

const caseResults = [
  { emoji: "🚗", label: "תאונת דרכים", detail: "נכות 15% | גיל 35", amount: "₪320,000 פיצוי", note: "לעומת הצעת הביטוח: ₪60,000" },
  { emoji: "🏍️", label: "תאונת אופנוע", detail: "נכות 25% | גיל 28", amount: "₪680,000 פיצוי", note: "הושג לאחר ערעור" },
  { emoji: "🚶", label: "הולך רגל", detail: "נכות 10% | גיל 52", amount: "₪185,000 פיצוי", note: "הסתיים בפשרה תוך 8 חודשים" },
];

const faqItems = [
  { q: "כמה זמן לוקח לקבל פיצוי?", a: "ברוב המקרים 6-18 חודשים. תאונות קלות — מהר יותר." },
  { q: "האם גם אם אני אשם בתאונה מגיע לי פיצוי?", a: "כן! חוק הפלת״ד קובע אחריות מוחלטת — גם נהג אשם זכאי לפיצוי." },
  { q: "מה ההבדל בין פלת״ד לביטוח מקיף?", a: "פלת״ד מכסה נזקי גוף. ביטוח מקיף מכסה נזק לרכב." },
  { q: "האם צריך לשלם מראש?", a: "לא. שכ״ט רק מהפיצוי — 8%-13% לפי חוק." },
  { q: "מה קורה אם הרכב הפוגע ברח?", a: "תובעים את קרנית — קרן המדינה לפיצוי נפגעי תאונות." },
  { q: "האם גם הולך רגל שנפגע זכאי לפיצוי?", a: "כן, מביטוח החובה של הרכב הפוגע." },
  { q: "מה המינימום לתביעה?", a: "אין מינימום. גם תאונה ללא שברים מזכה בפיצוי." },
  { q: "כמה שווה 10% נכות?", a: "תלוי בגיל ושכר — בדרך כלל ₪40,000-₪120,000 ומעלה." },
  { q: "האם PTSD מוכר לפיצוי?", a: "כן. נזק נפשי מוכר בחוק כנזק גוף לכל דבר." },
  { q: "מה לעשות מיד אחרי תאונה?", a: "1. צלם 2. קבל טיפול רפואי 3. רשום פרטי נהג 4. פנה לעו״ד" },
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
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 28, color: "#e8e0d0" }}>תוצאות אמיתיות של לקוחות</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {caseResults.map((c, i) => (
            <div key={i} style={{ background: "#0d1323", border: "1px solid #1e2d4a", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 18 }}>{c.emoji} {c.label}</span>
              <span style={{ fontSize: 14, color: "#7a8fa5" }}>{c.detail}</span>
              <strong style={{ fontSize: 22, color: G }}>{c.amount}</strong>
              <small style={{ fontSize: 13, color: "#7a8fa5" }}>{c.note}</small>
            </div>
          ))}
        </div>
      </section>

      {/* ── EXPANDED FAQ ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "56px 0 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 28, color: "#e8e0d0" }}>שאלות נפוצות — תאונות דרכים ופיצויים</h2>
        <div>
          {faqItems.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ── SEO KEYWORDS ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0" }}>
        <p style={{ fontSize: 14, color: "#3a4a5a", lineHeight: 2, textAlign: "center" }}>
          חישוב פיצויים תאונת דרכים | כאב וסבל פלת״ד | מחשבון נזק גוף | זכויות נפגעי תאונות | פיצוי ביטוח חובה | עורך דין נזיקין
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
    metaTitle="דוגמאות לפיצויים תאונות דרכים | כמה מגיע לך?"
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
