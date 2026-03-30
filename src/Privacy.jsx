export default function Privacy() {
  const G = "#c9a84c";
  const s = { fontSize:15, lineHeight:"1.8", color:"#b0bec5", marginBottom:8 };
  return (
    <div style={{ fontFamily:"'Heebo',sans-serif", direction:"rtl", background:"#080d18", color:"#e8edf2", minHeight:"100vh", padding:"80px 24px 60px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}h2{color:${G};font-size:20px;margin:36px 0 12px;border-bottom:1px solid #1e2d4a;padding-bottom:8px}ul{padding-right:24px;margin-bottom:12px}li{font-size:15px;line-height:1.8;color:#b0bec5;margin-bottom:4px}a{color:${G}}`}</style>
      <div style={{ maxWidth:760, margin:"0 auto" }}>
        <a href="/" style={{ color:G, fontSize:14, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>← חזרה לעמוד הבית</a>

        <h1 style={{ fontSize:36, fontWeight:900, margin:"24px 0 4px" }}>מדיניות פרטיות</h1>
        <p style={{ color:"#7a8fa5", fontSize:13, marginBottom:32 }}>עדכון אחרון: מרץ 2025 | nifgati.co.il</p>

        <h2>1. מי אנחנו</h2>
        <p style={s}>nifgati.co.il הוא האתר של <strong>דן אלון, עורך דין נזיקין</strong>.<br />
        לפניות בנושא פרטיות: <a href="mailto:info@nifgati.co.il">info@nifgati.co.il</a> | 050-1234567</p>

        <h2>2. איזה מידע נאסף</h2>
        <ul>
          <li><strong>מידע שמוסר מרצון:</strong> שם, טלפון, פרטי התאונה — רק אם פנית אלינו ישירות (WhatsApp / טלפון).</li>
          <li><strong>שיחות הבוט:</strong> שיחות עם בוט הפיצויים <strong>אינן נשמרות</strong> בשרתינו. הן מועברות לעיבוד בלבד דרך Claude API של חברת Anthropic בכפוף <a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer">למדיניות הפרטיות שלהם</a>.</li>
          <li><strong>עוגיות (Cookies):</strong> האתר משתמש בעוגיות לצרכי ניתוח גלישה ופרסום ממוקד בלבד.</li>
          <li><strong>נתוני גלישה:</strong> כתובת IP, סוג דפדפן, עמודים שביקרת — באופן אנונימי.</li>
        </ul>

        <h2>3. למה אנחנו משתמשים במידע</h2>
        <ul>
          <li>מתן שירות משפטי ומענה לפניות</li>
          <li>שיפור חוויית השימוש באתר</li>
          <li>פרסום ממוקד (Remarketing) — הצגת מודעות רלוונטיות בפייסבוק וגוגל</li>
        </ul>

        <h2>4. עוגיות ופרסום</h2>
        <p style={s}>האתר משתמש ב:</p>
        <ul>
          <li><strong>Google Analytics</strong> — ניתוח תנועה אנונימי</li>
          <li><strong>Facebook Pixel</strong> — Remarketing (הצגת מודעות למבקרי האתר)</li>
          <li><strong>Google Ads</strong> — מעקב המרות</li>
        </ul>
        <p style={s}><strong>שיחות הבוט אינן חלק ממעקב העוגיות.</strong></p>
        <p style={s}>לביטול עוגיות: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">כלי הביטול של Google</a> | הגדרות הדפדפן שלך.</p>

        <h2>5. שיתוף מידע עם צדדים שלישיים</h2>
        <p style={s}>אנחנו <strong>לא מוכרים</strong> מידע אישי. מידע יועבר רק:</p>
        <ul>
          <li>לצורך מתן השירות המשפטי (למשל מומחים רפואיים — בהסכמתך בלבד)</li>
          <li>לפי דרישת חוק או צו בית משפט</li>
          <li>לשירותי עיבוד AI (Anthropic) — לעיבוד שיחות הבוט בלבד, ללא שמירה אצלנו</li>
        </ul>

        <h2>6. זכויותיך לפי חוק הגנת הפרטיות</h2>
        <ul>
          <li><strong>עיון:</strong> זכות לעיין במידע שנאסף עליך</li>
          <li><strong>תיקון:</strong> זכות לתקן מידע שגוי</li>
          <li><strong>מחיקה:</strong> זכות למחיקת מידע ("הזכות להישכח")</li>
          <li><strong>התנגדות:</strong> זכות להתנגד לשימוש לצרכי שיווק</li>
          <li><strong>ניידות:</strong> זכות לקבל את המידע שלך בפורמט קריא</li>
        </ul>
        <p style={s}>לפנייה: <a href="mailto:info@nifgati.co.il">info@nifgati.co.il</a> — נענה תוך 30 יום.</p>

        <h2>7. אבטחת מידע</h2>
        <ul>
          <li>האתר פועל על HTTPS מוצפן</li>
          <li>שיחות הבוט עוברות דרך שרת ביניים מאובטח ואינן נשמרות</li>
          <li>ה-API Key שמורה כ-Environment Variable ואינה נחשפת</li>
          <li>Rate Limiting — הגבלת בקשות למניעת שימוש לרעה</li>
        </ul>

        <h2>8. שמירת מידע</h2>
        <p style={s}>מידע שנמסר מרצון נשמר לתקופה הנדרשת לטיפול המשפטי, ולא יותר מ-7 שנים בהתאם לדרישות החוק הישראלי.</p>

        <h2>9. שינויים במדיניות</h2>
        <p style={s}>נעדכן דף זה בעת שינויים מהותיים. תאריך העדכון יופיע בראש הדף.</p>

        <h2>10. יצירת קשר — ממונה פרטיות</h2>
        <p style={s}>דן אלון, עורך דין נזיקין<br />
        דוא"ל: <a href="mailto:info@nifgati.co.il">info@nifgati.co.il</a><br />
        טלפון: 050-1234567</p>

        <div style={{ marginTop:48, padding:"16px 20px", background:"#0d1323", border:"1px solid #1e2d4a", borderRadius:12, fontSize:13, color:"#7a8fa5" }}>
          האתר אינו מהווה ייעוץ משפטי. כל מקרה נבחן באופן אישי.
        </div>
      </div>
    </div>
  );
}
