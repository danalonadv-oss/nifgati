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
  if (t.includes('כאב') && t.includes('סבל'))
    return 'מחשבון כאב וסבל — חישוב מדויק לפי פלת״ד';
  if (t.includes('נזקי גוף') || t.includes('נזק גוף'))
    return 'מחשבון נזקי גוף — חישוב פיצוי מיידי';
  if (t.includes('מחשבון'))
    return 'מחשבון פיצויים תאונת דרכים — תוצאה תוך דקה';
  return 'מחשבון פיצויים חינמי — כמה מגיע לך?';
}

function getDynamicSubtitle() {
  const t = getUtmTerm();
  if (t.includes('כאב') && t.includes('סבל'))
    return 'חישוב מדויק לפי נוסחת פלת״ד — כאב וסבל, נכות, הפסד שכר';
  return 'חישוב חינמי לפי חוק הפלת״ד — תוך 60 שניות, אנונימי';
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
      {/* ── HOW IT WORKS ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0", direction: "rtl" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 20, color: "#e8e0d0" }}>איך עובד מחשבון כאב וסבל?</h2>
        <p style={{ fontSize: 15, color: "#7a8fa5", lineHeight: 1.8, marginBottom: 24 }}>
          מחשבון כאב וסבל מבוסס על נוסחת הפיצוי הקבועה בתקנות הפלת״ד.
          הוא מחשב את הפיצוי לפי שלושה נתונים: אחוז נכות, מספר ימי אשפוז, וגיל הנפגע.
          סכום הבסיס המקסימלי עומד על כ-₪180,000 עבור 100% נכות.
        </p>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#e8e0d0", marginBottom: 14 }}>מה נכלל בחישוב?</h3>
        <ul style={{ fontSize: 15, color: "#7a8fa5", lineHeight: 2.2, paddingRight: 20, margin: 0 }}>
          <li><strong style={{ color: "#e8e0d0" }}>כאב וסבל</strong> — פיצוי על הסבל הפיזי והנפשי</li>
          <li><strong style={{ color: "#e8e0d0" }}>הפסד שכר</strong> — בתקופת ההחלמה ולעתיד</li>
          <li><strong style={{ color: "#e8e0d0" }}>הוצאות רפואיות</strong> — טיפולים, תרופות, שיקום</li>
          <li><strong style={{ color: "#e8e0d0" }}>עזרת צד שלישי</strong> — סיוע בבית בתקופת ההחלמה</li>
        </ul>
      </section>

      {/* ── SEO TEXT ── */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "48px 0 0" }}>
        <p style={{ fontSize: 12, color: "#556070", lineHeight: 2, textAlign: "center" }}>
          מחשבון כאב וסבל | חישוב פיצויים תאונת דרכים | מחשבון נזקי גוף | פיצוי לפי פלת״ד | חישוב נכות מתאונה | מחשבון פיצויים חינמי
        </p>
      </section>
    </>
  );
}

export default function Machshevon() {
  const [title] = useState(getDynamicTitle);
  const [subtitle] = useState(getDynamicSubtitle);

  return <LandingPage
    pageTitle={title}
    pageSubtitle={subtitle}
    metaTitle={title + " | נפגעתי"}
    metaDescription="מחשבון כאב וסבל וחישוב פיצויים לפי פלת״ד — חינם, אנונימי, תוך 60 שניות. כולל הפסד שכר, נכות והוצאות רפואיות."
    heroEmoji="🧮"
    bullets={["מחשב 4 ראשי נזק לפי חוק הפלת״ד","תוצאה תוך 60 שניות — חינם ואנונימי","הנתונים לא נשמרים ולא מתועדים"]}
    ctaText="חשב פיצוי עכשיו"
    pageSlug="machshevon"
    socialProofLabel="ממוצע תיק שטופל"
    bannerText="מחשבון פיצויים — חשב ודע מיד כמה מגיע לך"
    extraContent={<ExtraContent />}
  />;
}
