import { useState, useEffect, useRef } from "react";
import Bot from "./Bot.jsx";

const PHONE    = "0544338212";
const WA       = "972544338212";
const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";

export default function LandingPage({ pageTitle, pageSubtitle, heroEmoji, bullets, ctaText, pageSlug, bannerText }) {
  const [scrolled, setScrolled]     = useState(false);
  const [showBot, setShowBot]       = useState(false);
  const [cookie, setCookie]         = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const botOpenedRef = useRef(false);

  /* ── Auto-open bot after 2.5s, once per session ── */
  useEffect(() => {
    if (sessionStorage.getItem("botAutoOpened")) return;
    const timer = setTimeout(() => {
      setShowBot(true);
      sessionStorage.setItem("botAutoOpened", "1");
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  function openBot() {
    setShowBot(true);
    botOpenedRef.current = true;
  }

  const G = "#c9a84c";
  const gBtn = { background:G, color:"#060a12", border:"none", borderRadius:12, fontFamily:"inherit", fontWeight:800, fontSize:15, padding:"14px 28px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, transition:"all .2s" };
  const oBtn = { background:"transparent", color:G, border:`1.5px solid ${G}88`, borderRadius:12, fontFamily:"inherit", fontWeight:700, fontSize:14, padding:"12px 24px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 };

  return (
    <div style={{ fontFamily:"'Heebo',Arial,sans-serif", direction:"rtl", background:"#080d18", color:"#e8edf2", overflowX:"hidden", minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        a{text-decoration:none;color:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1e2d4a;border-radius:2px}
        .nl{color:#7a8fa5;font-size:14px;font-weight:500;border-bottom:2px solid transparent;transition:all .2s}
        .nl:hover{color:#c9a84c;border-bottom-color:#c9a84c}
        .wa-btn{position:fixed;bottom:24px;left:24px;background:#25d366;color:#fff;border:none;border-radius:50%;width:56px;height:56px;font-size:24px;cursor:pointer;box-shadow:0 8px 24px #25d36655;z-index:99;display:flex;align-items:center;justify-content:center;transition:transform .2s}
        .wa-btn:hover{transform:scale(1.1)}
        .hm{display:flex}
        @media(min-width:769px){.hero-wrap{max-width:1200px!important;padding:60px 80px!important}.ht{font-size:4.5rem!important;line-height:1.2!important}.hero-sub{font-size:1.6rem!important}.hero-bullets{font-size:1.2rem!important;max-width:800px!important;margin:0 auto 32px!important}.sect-inner{max-width:1200px!important}}
        @media(max-width:768px){.hm{display:none!important}.ht{font-size:34px!important}}
      `}</style>

      {/* SKIP NAV */}
      <a href="#main-content" style={{ position:"absolute", top:-40, right:0, background:G, color:"#000", padding:"8px 16px", borderRadius:"0 0 8px 0", fontSize:14, fontWeight:700, zIndex:999, transition:"top .2s" }} onFocus={e => e.target.style.top = "0"} onBlur={e => e.target.style.top = "-40px"}>דלג לתוכן הראשי</a>

      {/* URGENCY BANNER */}
      {showBanner && (
        <div style={{ position:"fixed", top:0, right:0, left:0, width:"100%", boxSizing:"border-box", zIndex:110, background:G, color:"#060a12", height:40, display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:14, fontWeight:700, padding:"0 12px" }}>
          <span style={{ flex:1, textAlign:"center" }}>{bannerText || "תביעות פלת״ד — חשב ודע מיד כמה מגיע לך"}</span>
          <button onClick={() => setShowBanner(false)} aria-label="סגור באנר" style={{ background:"transparent", border:"none", color:"#060a12", fontSize:18, cursor:"pointer", lineHeight:1, fontWeight:900, flexShrink:0 }}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <header role="banner" style={{ position:"fixed", top:showBanner ? 40 : 0, right:0, left:0, zIndex:100, background:scrolled ? "#080d18f0" : "transparent", backdropFilter:scrolled ? "blur(12px)" : "none", borderBottom:scrolled ? "1px solid #1e2d4a" : "1px solid transparent", transition:"all .3s", padding:"0 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", height: window.innerWidth <= 768 ? 52 : 64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" aria-label="nifgati — עמוד בית" style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/logo.png" alt="nifgati" style={{ height: window.innerWidth <= 768 ? 32 : 68, width:"auto", objectFit:"contain" }} />
          </a>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <a href="tel:0544338212" aria-label="התקשר אלינו" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width: window.innerWidth <= 768 ? 36 : 48, height: window.innerWidth <= 768 ? 36 : 48, background:"#22c55e", borderRadius: window.innerWidth <= 768 ? 10 : 14, color:"#fff", fontSize: window.innerWidth <= 768 ? 18 : 22, textDecoration:"none", flexShrink:0, boxShadow:"0 2px 8px #22c55e55" }}>📞</a>
            <button style={gBtn} onClick={openBot} aria-label="בדיקת גובה הפיצוי">בדיקת פיצוי</button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main id="main-content" role="main" style={{ flex:1 }}>

        {/* HERO */}
        <section aria-label={pageTitle} style={{ minHeight:"100vh", display:"flex", alignItems:"center", position:"relative", overflow:"hidden", paddingTop:showBanner ? 120 : 80 }}>
          <div style={{ position:"absolute", top:"20%", right:"-8%", width:500, height:500, background:"radial-gradient(circle, #c9a84c09 0%, transparent 70%)", pointerEvents:"none" }} aria-hidden="true" />
          <div className="hero-wrap" style={{ maxWidth:900, margin:"0 auto", padding:"80px 24px", width:"100%", textAlign:"center" }}>

              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:15, fontWeight:700, color:"#e8edf2" }}>דן אלון, עו״ד נזיקין</div>
                <div style={{ fontSize:13, color:"#7a8fa5" }}>25 שנות ניסיון</div>
              </div>

              <h1 className="ht" style={{ fontSize:44, fontWeight:900, lineHeight:1.25, marginBottom:14 }}>
                {pageTitle}
              </h1>
              <h2 className="hero-sub" style={{ fontSize:18, fontWeight:700, color:"#7a8fa5", marginBottom:32, lineHeight:1.6 }}>{pageSubtitle}</h2>

              <div className="hero-bullets" style={{ display:"inline-flex", flexDirection:"column", gap:12, marginBottom:32, textAlign:"right" }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:15, color:"#bcc8d4", lineHeight:1.6 }}>
                    <span style={{ color:G, fontWeight:700, flexShrink:0, fontSize:16, marginTop:2 }}>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:40, justifyContent:"center" }}>
                <button style={{ ...gBtn, fontSize:16, padding:"16px 32px" }} onClick={openBot} aria-label="בדיקת גובה הפיצוי">💬 {ctaText || "לבדיקת גובה הפיצוי שלי"}</button>
              </div>

              <div style={{ display:"flex", gap:10, fontSize:13, color:"#556070", justifyContent:"center" }}>
                <span>🔒 אנונימי</span>
                <span>|</span>
                <span>⚡ תוך 60 שניות</span>
                <span>|</span>
                <span>₪0 מראש</span>
              </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section style={{ padding:"68px 24px", background:"#0d1323" }}>
          <div className="sect-inner" style={{ maxWidth:500, margin:"0 auto", textAlign:"center" }}>
            <h2 style={{ fontSize:28, fontWeight:900, marginBottom:12 }}>דברו איתנו עכשיו</h2>
            <p style={{ color:"#7a8fa5", fontSize:15, marginBottom:36 }}>ייעוץ ראשוני חינמי, ללא התחייבות</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button style={{ ...gBtn, width:"100%", justifyContent:"center", fontSize:16, padding:16 }} onClick={openBot} aria-label="פתח מחשבון פיצויים">🤖 חשב כמה מגיע לך — חינם</button>
              <a href={`tel:${PHONE}`}>
                <button style={{ ...oBtn, width:"100%", justifyContent:"center", fontSize:16, padding:16 }} aria-label={`התקשר: ${PHONE}`}>📞 {PHONE} — התקשר עכשיו</button>
              </a>
            </div>
            <address style={{ marginTop:36, fontSize:13, color:"#7a8fa5", lineHeight:2, fontStyle:"normal" }}>
              <div>{MY_NAME} — {MY_TITLE} | 25 שנות ניסיון</div>
              <div>חנה זמר 7, תל אביב</div>
              <div>ימים א׳–ה׳ | 9:00–19:00</div>
              <div><a href="mailto:Danalonadv@gmail.com" style={{ color:G }}>Danalonadv@gmail.com</a></div>
            </address>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer role="contentinfo" style={{ background:"#060a12", borderTop:"1px solid #1e2d4a", padding:"24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div style={{ fontSize:13, color:"#7a8fa5" }}>© 2025 nifgati.co.il | {MY_NAME}, עו״ד נזיקין (25 שנות ניסיון)</div>
          <nav aria-label="קישורי מדיניות" style={{ display:"flex", gap:20 }}>
            <a href="/privacy" style={{ fontSize:12, color:"#7a8fa5" }}>מדיניות פרטיות</a>
            <a href="/accessibility" style={{ fontSize:12, color:"#7a8fa5" }}>נגישות</a>
            <a href="#" style={{ fontSize:12, color:"#7a8fa5" }}>תנאי שימוש</a>
          </nav>
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:"#2a3545", marginTop:12 }}>
          האתר אינו מהווה ייעוץ משפטי. כל מקרה נבחן באופן אישי. | שיחות הבוט אינן נשמרות ואינן מתועדות בשום אופן.
        </p>
      </footer>

      {/* Floating bot button */}
      {!showBot && (
        <button
          onClick={() => setShowBot(true)}
          style={{
            position: "fixed",
            bottom: 100,
            left: 24,
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #c9a84c, #f0d080)",
            color: "#080d18",
            fontSize: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(201,168,76,0.6)",
            zIndex: 1000,
            border: "none",
            flexDirection: "column",
            gap: 2
          }}
          aria-label="פתח מחשבון פיצויים"
        >
          🧮
          <span style={{ fontSize: 9, fontWeight: 800 }}>חשב פיצוי</span>
        </button>
      )}

      {/* WhatsApp float */}
      <button className="wa-btn" onClick={() => window.open(`https://wa.me/${WA}`, "_blank", "noopener,noreferrer")} aria-label="פתח שיחת וואטסאפ">💬</button>

      {/* Cookie Banner */}
      {!cookie && (
        <div style={{ position:"fixed", bottom:0, right:0, left:0, background:"#0a0f1eee", borderTop:"1px solid #1e2d4a22", padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, zIndex:98, fontSize:11, color:"#445566" }}>
          <span>האתר משתמש בעוגיות Remarketing בלבד. שיחות הבוט אינן נשמרות. <a href="/privacy" style={{ color:"#c9a84c88" }}>פרטיות</a></span>
          <button style={{ background:"#c9a84c22", color:"#c9a84c", border:"1px solid #c9a84c44", borderRadius:8, fontFamily:"inherit", fontSize:11, padding:"4px 10px", cursor:"pointer", flexShrink:0 }} onClick={() => setCookie(true)}>אישור ✓</button>
        </div>
      )}

      {/* Bot */}
      {showBot && <Bot onClose={() => setShowBot(false)} />}
    </div>
  );
}
