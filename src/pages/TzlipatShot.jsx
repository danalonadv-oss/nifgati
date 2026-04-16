import { useState } from "react";
import LandingPage from "../LandingPage.jsx";

const G = "#0a2240";

function getUtmTerm() {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get("utm_term");
  if (!raw) return "";
  return decodeURIComponent(raw.replace(/\+/g, " ")).trim().toLowerCase();
}

function getDynamicTitle() {
  const t = getUtmTerm();
  if (t.includes('דוגמאות') && t.includes('צליפת שוט'))
    return 'דוגמאות לפיצויים על צליפת שוט — ראה כמה קיבלו';
  if (t.includes('צליפת שוט') && t.includes('פיצויים'))
    return 'צליפת שוט — כמה פיצוי מגיע לך?';
  if (t.includes('כאבי ראש'))
    return 'כאבי ראש אחרי תאונה? בדוק פיצוי עכשיו';
  if (t.includes('צליפת שוט'))
    return 'צליפת שוט בתאונת דרכים — בדוק פיצוי';
  return 'צליפת שוט — בדוק כמה פיצוי מגיע לך';
}

function getDynamicSubtitle() {
  const t = getUtmTerm();
  if (t.includes('דוגמאות'))
    return 'דוגמאות אמיתיות לפיצויים על צליפת שוט — גלה כמה מגיע גם לך';
  if (t.includes('כאבי ראש'))
    return 'כאבי ראש מתמשכים אחרי תאונה מוכרים כצליפת שוט — בדוק פיצוי חינם';
  return 'צליפת שוט מוכרת בחוק גם ללא שבר. גלה כמה פיצוי מגיע לך — חינם, תוך 60 שניות';
}

const whiplashExamples = [
  { disability: "נכות 5%", amount: "₪45,000" },
  { disability: "נכות 10%", amount: "₪120,000" },
  { disability: "נכות 15%", amount: "₪220,000" },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #dde3ea" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", background: "none", border: "none", color: "#0a2240", fontFamily: "inherit", fontSize: 16, fontWeight: 700, padding: "18px 0", cursor: "pointer", textAlign: "right", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
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
      {/* ── WHIPLASH EXPLAINER ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0", direction: "rtl" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 20, color: "#0a2240" }}>צליפת שוט — מה זה ומה מגיע לך?</h2>
        <p style={{ fontSize: 15, color: "#7a8fa5", lineHeight: 1.8, marginBottom: 24 }}>
          צליפת שוט (Whiplash) היא פגיעה שכיחה בתאונות דרכים, בעיקר בתאונות מאחור.
          הפגיעה מוכרת בחוק גם ללא שבר גלוי ומזכה בפיצוי לפי פלת״ד.
        </p>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0a2240", marginBottom: 14 }}>סימנים נפוצים:</h3>
        <ul style={{ fontSize: 15, color: "#7a8fa5", lineHeight: 2.2, paddingRight: 20, margin: "0 0 28px" }}>
          <li>כאבי צוואר וגב עליון</li>
          <li>כאבי ראש מתמשכים</li>
          <li>סחרחורות וטשטוש</li>
          <li>הגבלה בתנועות הצוואר</li>
        </ul>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0a2240", marginBottom: 14 }}>דוגמאות לפיצויים על צליפת שוט:</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          {whiplashExamples.map((c, i) => (
            <div key={i} style={{ background: "#f8f9fb", border: "1px solid #dde3ea", borderRadius: 14, padding: "20px 24px", textAlign: "center" }}>
              <span style={{ fontSize: 14, color: "#7a8fa5", display: "block", marginBottom: 6 }}>{c.disability}</span>
              <strong style={{ fontSize: 28, fontWeight: 700, color: G }}>{c.amount}</strong>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#556070", textAlign: "center", marginTop: 12 }}>*הסכומים להמחשה בלבד. כל מקרה נבחן באופן אישי.</p>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "56px 0 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 28, color: "#0a2240" }}>שאלות נפוצות — צליפת שוט</h2>
        <div>
          <FaqItem q="צליפת שוט ללא שבר — מגיע לי פיצוי?" a="כן. צליפת שוט מוכרת כנזק גוף בחוק גם ללא שבר. כאבי צוואר וגב מזכים בפיצוי." />
          <FaqItem q="התאונה נראתה קלה אבל יש לי כאבים — מה עושים?" a="פנו מיד לרופא ותעדו את הכאבים. גם תאונה קלה יכולה לגרום לצליפת שוט שמזכה בפיצוי." />
          <FaqItem q="כמה זמן לוקח להחלים מצליפת שוט?" a="רוב המקרים — 3-6 חודשים. במקרים קשים הכאבים הופכים כרוניים ומזכים בנכות צמיתה." />
          <FaqItem q="האם כאבי ראש אחרי תאונה מזכים בפיצוי?" a="כן. כאבי ראש מתמשכים הם סימפטום מוכר של צליפת שוט ומזכים בפיצוי לפי החוק." />
        </div>
      </section>

      {/* ── SEO TEXT ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0" }}>
        <p style={{ fontSize: 12, color: "#556070", lineHeight: 2, textAlign: "center" }}>
          צליפת שוט פיצויים | תאונת דרכים צליפת שוט | דוגמאות לפיצויים צליפת שוט | כאבי ראש אחרי תאונה | פיצוי על צליפת שוט | Whiplash תאונת דרכים
        </p>
      </section>
    </>
  );
}

export default function TzlipatShot() {
  const [title] = useState(getDynamicTitle);
  const [subtitle] = useState(getDynamicSubtitle);

  return <LandingPage
    pageTitle={title}
    pageSubtitle={subtitle}
    metaTitle={title + " | נפגעתי"}
    metaDescription="צליפת שוט מתאונת דרכים — פיצוי גם ללא שבר. דוגמאות: ₪45,000 עד ₪220,000. בדוק כמה מגיע לך חינם."
    heroEmoji="🩺"
    bullets={["הנתונים לא נשמרים","חישוב לפי חומרת הפגיעה","ייצוג מול חברת הביטוח"]}
    ctaText="חשב פיצוי על צליפת שוט"
    pageSlug="tzlipat-shot"
    socialProofLabel="צליפת שוט — נכות 5%"
    bannerText="צליפת שוט — חשב ודע מיד כמה מגיע לך"
    extraContent={<ExtraContent />}
  />;
}
