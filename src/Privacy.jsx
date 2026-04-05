export default function Privacy() {
  const G = "#c9a84c";
  const s = { fontSize:15, lineHeight:"1.8", color:"#b0bec5", marginBottom:8 };
  return (
    <div style={{ fontFamily:"'Heebo',Arial,sans-serif", direction:"rtl", background:"#080d18", color:"#e8edf2", minHeight:"100vh", padding:"80px 24px 60px" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}h2{color:${G};font-size:20px;margin:36px 0 12px;border-bottom:1px solid #1e2d4a;padding-bottom:8px}ul{padding-right:24px;margin-bottom:12px}li{font-size:15px;line-height:1.8;color:#b0bec5;margin-bottom:4px}a{color:${G}}`}</style>
      <div style={{ maxWidth:760, margin:"0 auto" }}>
        <a href="/" style={{ color:G, fontSize:14, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>← חזרה לעמוד הבית</a>

        <h1 style={{ fontSize:36, fontWeight:900, margin:"24px 0 4px" }}>מדיניות פרטיות</h1>
        <p style={{ color:"#7a8fa5", fontSize:13, marginBottom:32 }}>עדכון אחרון: מרץ 2025 | nifgati.co.il</p>

        <h2>1. מי אנחנו</h2>
        <p style={s}>nifgati.co.il הוא האתר של <strong>דן אלון, עורך דין נזיקין</strong>.<br />
        לפניות בנושא פרטיות: <a href="mailto:Danalonadv@gmail.com">Danalonadv@gmail.com</a> | <a href="tel:0544338212">054-4338212</a></p>

        <h2>2. מדיניות אי-איסוף מידע</h2>
        <p style={s}><strong>האתר אינו אוסף, אינו שומר ואינו מתעד מידע אישי של משתמשים.</strong></p>
        <ul>
          <li><strong>שיחות הבוט:</strong> שיחות עם בוט הפיצויים <strong>אינן נשמרות ואינן מתועדות בשום אופן</strong> — לא בשרתינו ולא בשום מאגר מידע. השיחה מועברת לעיבוד בזמן אמת דרך Claude API של חברת Anthropic ונמחקת מיד. ראה <a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer">מדיניות הפרטיות של Anthropic</a>.</li>
          <li><strong>טפסים / וואטסאפ:</strong> מידע שנמסר ביוזמתך (שם, טלפון) נשמר אצלנו לצורך טיפול בפנייה בלבד.</li>
          <li><strong>עוגיות:</strong> האתר משתמש בעוגיות לצרכי <strong>פרסום ממוקד (Remarketing) בלבד</strong> — כלומר הצגת מודעות רלוונטיות למי שביקר באתר. אין שימוש בעוגיות לצורך איסוף מידע אישי.</li>
        </ul>

        <h2>3. עוגיות ופרסום</h2>
        <p style={s}>האתר משתמש אך ורק בעוגיות הבאות:</p>
        <ul>
          <li><strong>Facebook Pixel</strong> — Remarketing בלבד (הצגת מודעות למבקרי האתר)</li>
          <li><strong>Google Ads</strong> — Remarketing ומעקב המרות בלבד</li>
        </ul>
        <p style={s}><strong>אין שימוש בעוגיות לאיסוף מידע אישי, זיהוי משתמשים, או שמירת היסטוריית שיחות.</strong></p>
        <p style={s}>לביטול עוגיות: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">כלי הביטול של Google</a> | הגדרות הדפדפן שלך.</p>

        <h2>4. שיתוף מידע עם צדדים שלישיים</h2>
        <p style={s}>אנחנו <strong>לא מוכרים ולא משתפים</strong> מידע אישי. מידע יועבר רק:</p>
        <ul>
          <li>לצורך מתן השירות המשפטי (למשל מומחים רפואיים — בהסכמתך המפורשת בלבד)</li>
          <li>לפי דרישת חוק או צו בית משפט</li>
          <li>לשירות Claude API (Anthropic) — לעיבוד שיחות בזמן אמת בלבד, ללא שמירה</li>
        </ul>

        <h2>5. זכויותיך לפי חוק הגנת הפרטיות</h2>
        <ul>
          <li><strong>עיון:</strong> זכות לעיין במידע שנאסף עליך</li>
          <li><strong>תיקון:</strong> זכות לתקן מידע שגוי</li>
          <li><strong>מחיקה:</strong> זכות למחיקת מידע ("הזכות להישכח")</li>
          <li><strong>התנגדות:</strong> זכות להתנגד לשימוש לצרכי שיווק</li>
        </ul>
        <p style={s}>לפנייה: <a href="mailto:Danalonadv@gmail.com">Danalonadv@gmail.com</a> — נענה תוך 30 יום.</p>

        <h2>6. אבטחת מידע</h2>
        <ul>
          <li>האתר פועל על HTTPS מוצפן</li>
          <li>שיחות הבוט עוברות דרך שרת ביניים מאובטח ונמחקות מיד לאחר העיבוד</li>
          <li>אין מסד נתונים — אין מה לפרוץ</li>
          <li>Rate Limiting — הגבלת בקשות למניעת שימוש לרעה</li>
        </ul>

        <h2>7. שמירת מידע</h2>
        <p style={s}><strong>שיחות הבוט:</strong> אינן נשמרות בשום אופן — נמחקות מיד.</p>
        <p style={s}><strong>פניות ישירות</strong> (וואטסאפ / טלפון): נשמרות לתקופה הנדרשת לטיפול המשפטי בלבד.</p>

        <h2>8. שינויים במדיניות</h2>
        <p style={s}>נעדכן דף זה בעת שינויים מהותיים. תאריך העדכון יופיע בראש הדף.</p>

        <h2>9. יצירת קשר — ממונה פרטיות</h2>
        <p style={s}>דן אלון, עורך דין נזיקין<br />
        דוא"ל: <a href="mailto:Danalonadv@gmail.com">Danalonadv@gmail.com</a><br />
        טלפון: <a href="tel:0544338212">054-4338212</a></p>

        <div style={{ marginTop:48, padding:"16px 20px", background:"#0d1323", border:"1px solid #1e2d4a", borderRadius:12, fontSize:13, color:"#7a8fa5" }}>
          האתר אינו מהווה ייעוץ משפטי. כל מקרה נבחן באופן אישי.
        </div>
      </div>
    </div>
  );
}

