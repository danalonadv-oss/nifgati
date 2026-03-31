import { useState, useEffect, useRef } from "react";
import Bot from "./Bot.jsx";

// ╔══════════════════════════════════════╗
// ║  שנה כאן את הפרטים שלך             ║
const PHONE    = "0544338212";
const WA       = "972544338212";
const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";
// ╚══════════════════════════════════════╝

function useInView() {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if(e.isIntersecting) setV(true); }, {threshold:.12});
    if(ref.current) o.observe(ref.current);
    return () => o.disconnect();
  },[]);
  return [ref, v];
}

function Reveal({ children }) {
  const [ref, v] = useInView();
  return <div ref={ref} style={{ opacity:v?1:0, transform:v?"none":"translateY(28px)", transition:"all .7s cubic-bezier(.22,1,.36,1)" }}>{children}</div>;
}

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [showBot,  setShowBot]  = useState(false);
  const [cookie,   setCookie]   = useState(false);

  useEffect(()=>{
    const fn=()=>setScrolled(window.scrollY>50);
    window.addEventListener("scroll",fn);
    return ()=>window.removeEventListener("scroll",fn);
  },[]);

  const G="#c9a84c";
  const gBtn={ background:G,color:"#060a12",border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:800,fontSize:15,padding:"14px 28px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8,transition:"all .2s" };
  const oBtn={ background:"transparent",color:G,border:`1.5px solid ${G}88`,borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:14,padding:"12px 24px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8 };

  const nav=[{l:"איך עובד",h:"#how"},{l:"לקוחות",h:"#why"},{l:"מחשבון",h:"#calc"},{l:"צור קשר",h:"#contact"}];
  const steps=[
    {n:"01",t:"חשב בחינם",d:"הבוט מחשב 4 ראשי נזק לפי חוק הפלת\"ד תוך דקות — ללא התחייבות."},
    {n:"02",t:"ייעוץ אישי",d:`שיחה ישירה עם ${MY_NAME}. מעריכים את התיק ומסבירים את הדרך.`},
    {n:"03",t:"אנחנו לוחמים",d:"אנחנו מול חברות הביטוח. אתה מתרכז בהחלמה."},
    {n:"04",t:"פיצוי בחשבון",d:"שכ\"ט רק מהפיצוי — 8%–13% בפלת\"ד. ללא תשלום מראש."},
  ];
  const reviews=[
    {n:"מיכל ר.",c:"תל אביב",t:"קיבלתי ₪220,000 אחרי שהביטוח הציע ₪40,000. דן לחם עבורי כל הדרך."},
    {n:"אלון מ.",c:"רמת גן",t:"נפלתי מקורקינט בגלל בור. לא ידעתי שמגיע לי פיצוי. דן פתח תיק תוך יום."},
    {n:"שירה כ.",c:"הרצליה",t:"תאונה בדרך לעבודה. קיבלתי פיצוי מלא מביטוח לאומי ומחברת הביטוח."},
  ];

  return (
    <div style={{ fontFamily:"'Heebo',sans-serif",direction:"rtl",background:"#080d18",color:"#e8edf2",overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        a{text-decoration:none;color:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1e2d4a;border-radius:2px}
        .nl{color:#7a8fa5;font-size:14px;font-weight:500;border-bottom:2px solid transparent;transition:all .2s}
        .nl:hover{color:#c9a84c;border-bottom-color:#c9a84c}
        .card{background:#111a2c;border:1px solid #1e2d4a;border-radius:18px;padding:28px 24px;transition:all .3s}
        .card:hover{border-color:#c9a84c55;transform:translateY(-4px)}
        .step{background:#0d1323;border:1px solid #1e2d4a;border-radius:18px;padding:28px 24px}
        .wa-btn{position:fixed;bottom:24px;left:24px;background:#25d366;color:#fff;border:none;border-radius:50%;width:56px;height:56px;font-size:24px;cursor:pointer;box-shadow:0 8px 24px #25d36655;z-index:99;display:flex;align-items:center;justify-content:center;transition:transform .2s}
        .wa-btn:hover{transform:scale(1.1)}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .div{width:56px;height:3px;background:#c9a84c;border-radius:2px;margin:0 auto 14px}
        .pulse{animation:p 2s ease-in-out infinite}
        @keyframes p{0%,100%{opacity:1}50%{opacity:.5}}
        .ck{position:fixed;bottom:0;right:0;left:0;background:#0d1323;border-top:1px solid #1e2d4a;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;z-index:98;font-size:13px;color:#7a8fa5}
        @media(max-width:768px){.g2,.g3{grid-template-columns:1fr}.g4{grid-template-columns:1fr 1fr}.hm{display:none!important}.ht{font-size:34px!important}}
        @media(max-width:480px){.g4{grid-template-columns:1fr 1fr}}
      `}</style>

      {/* SKIP NAV */}
      <a href="#main-content" style={{ position:"absolute",top:-40,right:0,background:G,color:"#000",padding:"8px 16px",borderRadius:"0 0 8px 0",fontSize:14,fontWeight:700,zIndex:999,transition:"top .2s" }} onFocus={e=>e.target.style.top="0"} onBlur={e=>e.target.style.top="-40px"}>דלג לתוכן הראשי</a>

      {/* HEADER */}
      <header role="banner" style={{ position:"fixed",top:0,right:0,left:0,zIndex:100,background:scrolled?"#080d18f0":"transparent",backdropFilter:scrolled?"blur(12px)":"none",borderBottom:scrolled?"1px solid #1e2d4a":"1px solid transparent",transition:"all .3s",padding:"0 24px" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",height:64,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <a href="/" aria-label="nifgati — עמוד בית" style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ background:G,color:"#060a12",fontWeight:900,fontSize:18,width:38,height:38,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center" }} aria-hidden="true">נ</div>
            <div><div style={{ fontWeight:900,fontSize:16,color:"#fff",lineHeight:1.1 }}>nifgati</div><div style={{ fontSize:10,color:"#7a8fa5",letterSpacing:1 }}>נפגעתי</div></div>
          </a>
          <nav role="navigation" aria-label="ניווט ראשי" style={{ display:"flex",gap:28,alignItems:"center" }} className="hm">
            {nav.map(n=><a key={n.l} href={n.h} className="nl">{n.l}</a>)}
          </nav>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <a href={`tel:${PHONE}`} aria-label={`התקשר אלינו: ${PHONE}`} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"#c9a84c18",border:"1px solid #c9a84c44",borderRadius:100,padding:"8px 16px",fontSize:14,fontWeight:700,color:G }} className="hm">📞 {PHONE}</a>
            <button style={gBtn} onClick={()=>setShowBot(true)} aria-label="פתח מחשבון פיצויים חינמי">בוט חישוב פיצויים</button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main id="main-content" role="main">

        {/* HERO */}
        <section id="hero" aria-label="עמוד ראשי" style={{ minHeight:"100vh",display:"flex",alignItems:"center",position:"relative",overflow:"hidden",paddingTop:80 }}>
          <div style={{ position:"absolute",top:"20%",right:"-8%",width:500,height:500,background:"radial-gradient(circle, #c9a84c09 0%, transparent 70%)",pointerEvents:"none" }} aria-hidden="true"/>
          <div style={{ maxWidth:1100,margin:"0 auto",padding:"80px 24px",width:"100%" }}>
            <div style={{ maxWidth:700 }}>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"#c9a84c18",border:"1px solid #c9a84c44",borderRadius:100,padding:"6px 16px",fontSize:13,color:G,marginBottom:28,fontWeight:600 }}>
                <span className="pulse" style={{ width:7,height:7,background:G,borderRadius:"50%",display:"inline-block" }} aria-hidden="true"/>
                ייעוץ חינמי ✓ תשלום רק מהפיצוי ✓ מענה תוך 24h
              </div>
              <h1 className="ht" style={{ fontSize:54,fontWeight:900,lineHeight:1.2,marginBottom:20 }}>
                נפגעת בתאונת דרכים?<br/>
                <span style={{ color:G }}>מגיע לך פיצוי.</span><br/>
                <span style={{ fontSize:"60%",fontWeight:500,color:"#7a8fa5" }}>בדוק כמה — עכשיו, בחינם.</span>
              </h1>
              <p style={{ fontSize:17,color:"#7a8fa5",lineHeight:1.8,marginBottom:36,maxWidth:530 }}>
                מחשבון הפיצויים מעריך את שווי התיק שלך תוך דקות. שיחה ישירה, שכ"ט רק מהפיצוי. המידע בשיחה אינו נשמר ואינו מתועד.
              </p>
              <div style={{ display:"flex",gap:14,flexWrap:"wrap",marginBottom:48 }}>
                <button style={gBtn} onClick={()=>setShowBot(true)} aria-label="פתח מחשבון פיצויים">🤖 בוט חישוב פיצויים</button>
                <button style={oBtn} onClick={()=>window.open(`https://wa.me/${WA}`,"_blank")} aria-label="פתח שיחת וואטסאפ">💬 וואטסאפ עכשיו</button>
              </div>
            </div>
          </div>
        </section>

        {/* HOW */}
        <section id="how" aria-label="איך זה עובד" style={{ padding:"80px 24px",background:"#0d1323" }}>
          <Reveal>
            <div style={{ maxWidth:1100,margin:"0 auto" }}>
              <div style={{ textAlign:"center",marginBottom:48 }}>
                <div className="div" aria-hidden="true"/>
                <h2 style={{ fontSize:32,fontWeight:900,marginBottom:10 }}>איך זה עובד</h2>
                <p style={{ color:"#7a8fa5",fontSize:15 }}>מהרגע שפנית ועד שהפיצוי בחשבון</p>
              </div>
              <div className="g2" role="list">
                {steps.map(s=>(
                  <div key={s.n} className="step" role="listitem">
                    <div style={{ fontSize:40,fontWeight:900,color:G,opacity:.15,lineHeight:1,marginBottom:8 }} aria-hidden="true">{s.n}</div>
                    <h3 style={{ fontSize:18,fontWeight:800,marginBottom:8 }}>{s.t}</h3>
                    <p style={{ fontSize:14,color:"#7a8fa5",lineHeight:1.75 }}>{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* CALCULATOR */}
        <section id="calc" aria-label="מחשבון פיצויים" style={{ padding:"80px 24px" }}>
          <Reveal>
            <div style={{ maxWidth:680,margin:"0 auto",textAlign:"center" }}>
              <div className="div" aria-hidden="true"/>
              <h2 style={{ fontSize:32,fontWeight:900,marginBottom:12 }}>מחשבון פיצויים חינמי</h2>
              <p style={{ color:"#7a8fa5",fontSize:15,marginBottom:36,lineHeight:1.75 }}>
                הבוט מחשב 4 ראשי נזק לפי חוק הפלת"ד — כאב וסבל, הפסדי שכר, אובדן כושר עתידי והוצאות רפואיות.
              </p>
              <div style={{ background:"#111a2c",border:"1px solid #c9a84c44",borderRadius:20,padding:"36px 32px",marginBottom:20 }}>
                <div style={{ fontSize:48,marginBottom:16 }} aria-hidden="true">🤖</div>
                <h3 style={{ fontSize:18,fontWeight:700,marginBottom:8 }}>בוט הפיצויים של nifgati</h3>
                <p style={{ fontSize:14,color:"#7a8fa5",marginBottom:24,lineHeight:1.7 }}>
                  ספר לנו מה קרה ← שאלות חכמות ← חישוב מלא ← ניתוב לוואטסאפ
                </p>
                <button style={{ ...gBtn,fontSize:16,padding:"16px 36px" }} onClick={()=>setShowBot(true)} aria-label="פתח את בוט הפיצויים">
                  🚀 התחל חישוב עכשיו
                </button>
              </div>
              <p style={{ fontSize:12,color:"#7a8fa5" }}>✓ חינמי &nbsp;|&nbsp; ✓ השיחה לא נשמרת בשרתינו &nbsp;|&nbsp; ✓ ללא התחייבות</p>
            </div>
          </Reveal>
        </section>

        {/* REVIEWS */}
        <section id="why" aria-label="ביקורות לקוחות" style={{ padding:"80px 24px",background:"#0d1323" }}>
          <Reveal>
            <div style={{ maxWidth:1100,margin:"0 auto" }}>
              <div style={{ textAlign:"center",marginBottom:48 }}>
                <div className="div" aria-hidden="true"/>
                <h2 style={{ fontSize:32,fontWeight:900,marginBottom:10 }}>לקוחות מספרים</h2>
              </div>
              <div className="g3" role="list">
                {reviews.map(r=>(
                  <article key={r.n} className="card" role="listitem" aria-label={`ביקורת מאת ${r.n}`}>
                    <div style={{ color:G,fontSize:14,letterSpacing:2,marginBottom:10 }} aria-label="5 כוכבים">★★★★★</div>
                    <blockquote style={{ fontSize:14,color:"#bcc8d4",lineHeight:1.75,marginBottom:16,fontStyle:"italic" }}>"{r.t}"</blockquote>
                    <footer style={{ display:"flex",justifyContent:"space-between" }}>
                      <cite style={{ fontSize:13,fontWeight:700,fontStyle:"normal" }}>{r.n}</cite>
                      <span style={{ fontSize:12,color:"#7a8fa5" }}>{r.c}</span>
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* CONTACT */}
        <section id="contact" aria-label="צור קשר" style={{ padding:"80px 24px" }}>
          <Reveal>
            <div style={{ maxWidth:500,margin:"0 auto",textAlign:"center" }}>
              <div className="div" aria-hidden="true"/>
              <h2 style={{ fontSize:32,fontWeight:900,marginBottom:12 }}>דברו איתנו עכשיו</h2>
              <p style={{ color:"#7a8fa5",fontSize:15,marginBottom:36 }}>ייעוץ ראשוני חינמי, ללא התחייבות</p>
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <button style={{ ...gBtn,width:"100%",justifyContent:"center",fontSize:16,padding:16 }} onClick={()=>setShowBot(true)} aria-label="פתח מחשבון פיצויים">🤖 חשב כמה מגיע לך — חינם</button>
                <a href={`tel:${PHONE}`}>
                  <button style={{ ...oBtn,width:"100%",justifyContent:"center",fontSize:16,padding:16 }} aria-label={`התקשר: ${PHONE}`}>📞 {PHONE} — התקשר עכשיו</button>
                </a>
              </div>
              <address style={{ marginTop:36,fontSize:13,color:"#7a8fa5",lineHeight:2,fontStyle:"normal" }}>
                <div>{MY_NAME} — {MY_TITLE}</div>
                <div>חנה זמר 7, תל אביב</div>
                <div>ימים א׳–ה׳ | 9:00–19:00</div>
                <div><a href="mailto:info@nifgati.co.il" style={{ color:G }}>info@nifgati.co.il</a></div>
              </address>
            </div>
          </Reveal>
        </section>

      </main>

      {/* FOOTER */}
      <footer role="contentinfo" style={{ background:"#060a12",borderTop:"1px solid #1e2d4a",padding:"24px" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12 }}>
          <div style={{ fontSize:13,color:"#7a8fa5" }}>© 2025 nifgati.co.il | {MY_NAME}, {MY_TITLE}</div>
          <nav aria-label="קישורי מדיניות" style={{ display:"flex",gap:20 }}>
            <a href="/privacy"       style={{ fontSize:12,color:"#7a8fa5" }}>מדיניות פרטיות</a>
            <a href="/accessibility" style={{ fontSize:12,color:"#7a8fa5" }}>נגישות</a>
            <a href="#"              style={{ fontSize:12,color:"#7a8fa5" }}>תנאי שימוש</a>
          </nav>
        </div>
        <p style={{ textAlign:"center",fontSize:11,color:"#2a3545",marginTop:12 }}>
          האתר אינו מהווה ייעוץ משפטי. כל מקרה נבחן באופן אישי. | שיחות הבוט אינן נשמרות ואינן מתועדות בשום אופן.
        </p>
      </footer>

      {/* WhatsApp float */}
      <button className="wa-btn" onClick={()=>window.open(`https://wa.me/${WA}`,"_blank")} aria-label="פתח שיחת וואטסאפ">💬</button>

      {/* Cookie Banner */}
      {!cookie && (
        <div style={{ position:"fixed",bottom:0,right:0,left:0,background:"#0a0f1eee",borderTop:"1px solid #1e2d4a22",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,zIndex:98,fontSize:11,color:"#445566" }}>
          <span>האתר משתמש בעוגיות Remarketing בלבד. שיחות הבוט אינן נשמרות. <a href="/privacy" style={{ color:"#c9a84c88" }}>פרטיות</a></span>
          <div style={{ display:"flex",gap:6,flexShrink:0 }}>
            <button style={{ background:"transparent",color:"#445566",border:"1px solid #1e2d4a",borderRadius:8,fontFamily:"inherit",fontSize:11,padding:"4px 10px",cursor:"pointer" }} onClick={()=>setCookie(true)}>רק הכרחיות</button>
            <button style={{ background:"#c9a84c22",color:"#c9a84c",border:"1px solid #c9a84c44",borderRadius:8,fontFamily:"inherit",fontSize:11,padding:"4px 10px",cursor:"pointer" }} onClick={()=>setCookie(true)}>אישור ✓</button>
          </div>
        </div>
      )}

      {/* Bot */}
      {showBot && <Bot onClose={()=>setShowBot(false)}/>}
    </div>
  );
}
