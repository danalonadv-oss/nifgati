export default function Accessibility() {
  const G = "#c9a84c";
  const s = { fontSize:15, lineHeight:"1.8", color:"#b0bec5", marginBottom:8 };
  return (
    <div style={{ fontFamily:"'Heebo',sans-serif", direction:"rtl", background:"#080d18", color:"#e8edf2", minHeight:"100vh", padding:"80px 24px 60px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}h2{color:${G};font-size:20px;margin:36px 0 12px;border-bottom:1px solid #1e2d4a;padding-bottom:8px}ul{padding-right:24px;margin-bottom:12px}li{font-size:15px;line-height:1.8;color:#b0bec5;margin-bottom:4px}a{color:${G}}`}</style>
      <div style={{ maxWidth:760, margin:"0 auto" }}>
        <a href="/" style={{ color:G, fontSize:14, textDecoration:"none" }}>← חזרה לעמוד הבית</a>
        <h1 style={{ fontSize:36, fontWeight:900, margin:"24px 0 4px" }}>הצהרת נגישות</h1>
        <p style={{ color:"#7a8fa5", fontSize:13, marginBottom:32 }}>עדכון: מרץ 2025 | nifgati.co.il</p>

        <h2>מחויבות לנגישות</h2>
        <p style={s}>nifgati.co.il מחויב לאפשר לאנשים עם מוגבלויות להשתמש באתר בצורה נגישה ונוחה, בהתאם ל<strong>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013</strong>, ותקן ישראלי <strong>IS 5568</strong> (WCAG 2.1 רמה AA).</p>

        <h2>מה בוצע באתר</h2>
        <ul>
          <li>תמיכה מלאה בכיוון קריאה מימין לשמאל (RTL)</li>
          <li>ניגודיות צבעים עומדת בדרישות WCAG AA</li>
          <li>גופנים קריאים בגדלים מתאימים (מינימום 14px)</li>
          <li>תמיכה בהגדלת טקסט עד 200% ללא אובדן תוכן</li>
          <li>ניווט מקלדת בכל הכפתורים והקישורים</li>
          <li>תגיות ARIA על אלמנטים אינטראקטיביים</li>
          <li>הודעות שגיאה ברורות ומוסברות</li>
          <li>Cookie Banner עם תגית role="dialog" לקוראי מסך</li>
          <li>שפה מוגדרת (lang="he") ב-HTML</li>
        </ul>

        <h2>תחומים בתהליך שיפור</h2>
        <ul>
          <li>הוספת תיאורי alt מורחבים לאייקונים</li>
          <li>שיפור ניווט מקלדת בחלון הבוט</li>
          <li>בדיקה מלאה עם קורא מסך NVDA ו-JAWS</li>
          <li>הוספת Skip Navigation link</li>
        </ul>

        <h2>טכנולוגיות נגישות נתמכות</h2>
        <ul>
          <li>דפדפנים: Chrome, Firefox, Safari, Edge (גרסאות עדכניות)</li>
          <li>קוראי מסך: NVDA, JAWS, VoiceOver</li>
          <li>מכשירים: Desktop, Tablet, Mobile</li>
        </ul>

        <h2>פניות נגישות</h2>
        <p style={s}>נתקלת בבעיית נגישות? אנחנו כאן לעזור:</p>
        <ul>
          <li>דוא"ל: <a href="mailto:Danalonadv@gmail.com">Danalonadv@gmail.com</a></li>
          <li>טלפון: 050-1234567</li>
          <li>נענה תוך <strong>5 ימי עסקים</strong></li>
        </ul>

        <h2>תאריך עדכון</h2>
        <p style={s}>מרץ 2025. האתר נבדק לנגישות אחת לשנה.</p>
      </div>
    </div>
  );
}
