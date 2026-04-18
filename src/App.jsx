import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { openWhatsApp, getWhatsAppUrl } from "./utils/whatsapp.js";
import { captureGclid } from "./utils/gclid.js";
const Bot = lazy(() => import("./Bot.jsx"));

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

/* ── FAQ Accordion Item ── */
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom:"1px solid #dde3ea" }}>
      <button
        onClick={() => setOpen(p => !p)}
        aria-expanded={open}
        style={{ width:"100%",background:"transparent",border:"none",color:"#0a2240",fontFamily:"inherit",fontSize:16,fontWeight:700,padding:"18px 0",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"right",direction:"rtl",gap:12 }}
      >
        <span>{q}</span>
        <span style={{ color:"#2a7ab5",fontSize:20,flexShrink:0,transition:"transform .3s",transform:open?"rotate(45deg)":"rotate(0)" }}>+</span>
      </button>
      <div style={{ maxHeight:open?300:0,overflow:"hidden",transition:"max-height .4s ease",paddingInlineStart:0 }}>
        <p style={{ fontSize:14,color:"#7a8fa5",lineHeight:1.85,paddingBottom:18 }}>{a}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [scrolled, setScrolled]       = useState(false);
  const [showBot, setShowBot]         = useState(false);
  const [cookie, setCookie]           = useState(() => sessionStorage.getItem("nifgati_consent") === "granted");
  const [showBanner, setShowBanner]   = useState(true);
  const [showExit, setShowExit]       = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth <= 768);
  const botOpenedRef = useRef(false);
  const exitSentRef  = useRef(false);

  useEffect(() => { captureGclid(); }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  /* ── Auto-open bot after 12 seconds, once per session ── */
  useEffect(() => {
    if (sessionStorage.getItem("botAutoOpened")) return;
    const timer = setTimeout(() => {
      if (document.readyState === 'complete') {
        setShowBot(true);
        sessionStorage.setItem("botAutoOpened", "1");
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  /* ── TRIGGER 1: 30s dwell time passive lead ── */
  /* ── TRIGGER: Exit intent (desktop: mouseY<50, mobile: 45s inactivity) ── */
  useEffect(() => {
    const isMobileDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    function fireExitIntent() {
      if (exitSentRef.current || sessionStorage.getItem("exitShown")) return;
      exitSentRef.current = true;
      sessionStorage.setItem("exitShown", "1");
      setShowExit(true);
    }

    if (isMobileDevice) {
      let timer = setTimeout(fireExitIntent, 45000);
      const reset = () => { clearTimeout(timer); timer = setTimeout(fireExitIntent, 45000); };
      window.addEventListener("touchstart", reset);
      window.addEventListener("scroll", reset);
      return () => { clearTimeout(timer); window.removeEventListener("touchstart", reset); window.removeEventListener("scroll", reset); };
    } else {
      const onMouse = (e) => { if (e.clientY < 50) fireExitIntent(); };
      document.addEventListener("mouseleave", onMouse);
      return () => document.removeEventListener("mouseleave", onMouse);
    }
  }, []);

  /* ── Helper: open bot and mark as opened ── */
  const firedBotOpened = useRef(false);
  function openBot() {
    setShowBot(true);
    botOpenedRef.current = true;
    sessionStorage.setItem("nifgati_bot_opened", "1");
    if (!firedBotOpened.current) {
      firedBotOpened.current = true;
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'bot_opened' });
      console.log("[nifgati] bot_opened fired (App)");
    }
  }

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /* ── Inject JSON-LD Schema ── */
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "כמה זמן לוקח לקבל פיצוי?", "acceptedAnswer": { "@type": "Answer", "text": "בדרך כלל 12–24 חודשים. במקרים דחופים ניתן לקבל מקדמות תוך 60 יום." } },
        { "@type": "Question", "name": "כמה עולה הייצוג?", "acceptedAnswer": { "@type": "Answer", "text": "₪0 מראש. שכר הטרחה הוא אחוזים קבועים בחוק (8%–13%) ומשולם רק מתוך הפיצוי שתקבל." } },
        { "@type": "Question", "name": "תאונה קלה ללא שברים — מגיע לי פיצוי?", "acceptedAnswer": { "@type": "Answer", "text": "כן. גם צליפת שוט (Whiplash) מזכה באלפי שקלים פיצוי. כל פגיעה גופנית מזכה בבדיקה." } },
      ]
    };
    const localBiz = {
      "@context": "https://schema.org",
      "@type": "Attorney",
      "name": "דן אלון — עורך דין נזיקין",
      "url": "https://nifgati.co.il",
      "telephone": "+972-54-4338212",
      "email": "Danalonadv@gmail.com",
      "address": { "@type": "PostalAddress", "streetAddress": "חנה זמר 7", "addressLocality": "תל אביב", "addressCountry": "IL" },
      "openingHours": "Mo-Th 09:00-19:00",
      "priceRange": "8%-13% מהפיצוי בלבד"
    };
    const ids = ["nifgati-faq-schema", "nifgati-local-schema"];
    [faqSchema, localBiz].forEach((schema, i) => {
      if (!document.getElementById(ids[i])) {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.id = ids[i];
        s.textContent = JSON.stringify(schema);
        document.head.appendChild(s);
      }
    });
  }, []);

  const G = "#0a2240";
  const gBtn = { background:G, color:"#ffffff", border:"none", borderRadius:12, fontFamily:"inherit", fontWeight:800, fontSize:15, padding:"14px 28px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, transition:"all .2s" };
  const oBtn = { background:"transparent", color:G, border:`1.5px solid ${G}88`, borderRadius:12, fontFamily:"inherit", fontWeight:700, fontSize:14, padding:"12px 24px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 };

  const nav = [{ l:"איך עובד", h:"#how" }, { l:"תוצאות", h:"#results" }, { l:"שאלות", h:"#faq" }, { l:"צור קשר", h:"#contact" }];

  const steps = [
    { n:"01", t:"חשב בחינם", d:"התחל כעת וקבל מייד את הסכום המוערך תוך דקת שיחה." },
    { n:"02", t:"ייעוץ אישי", d:`שיחה ישירה עם ${MY_NAME}. מעריכים את התיק ומסבירים את הדרך.` },
    { n:"03", t:"אנחנו לוחמים", d:"אנחנו מול חברות הביטוח. אתה מתרכז בהחלמה." },
    { n:"04", t:"פיצוי בחשבון", d:"שכ\"ט רק מהפיצוי — 8%–13% בפלת\"ד. ללא תשלום מראש." },
  ];

  const results = [
    { icon:"🚗", type:"תאונת דרכים", disability:"נכות 15%", badge:"פוצה בהצלחה" },
    { icon:"🏍️", type:"תאונת אופנוע", disability:"נכות 25%", badge:"פוצה בהצלחה" },
    { icon:"🏗️", type:"תאונת עבודה", disability:"נכות 10%", badge:"פוצה בהצלחה" },
  ];

  const reviews = [
    { n:"מיכל ר.", c:"תל אביב", t:"קיבלתי ₪220,000 אחרי שהביטוח הציע ₪40,000. דן לחם עבורי כל הדרך." },
    { n:"אלון מ.", c:"רמת גן", t:"נפלתי מקורקינט בגלל בור. לא ידעתי שמגיע לי פיצוי. דן פתח תיק תוך יום." },
    { n:"שירה כ.", c:"הרצליה", t:"תאונה בדרך לעבודה. קיבלתי פיצוי מלא מביטוח לאומי ומחברת הביטוח." },
  ];

  const faqItems = [
    { q:"כמה זמן לוקח לקבל פיצוי?", a:"בדרך כלל 12–24 חודשים. במקרים דחופים ניתן לקבל מקדמות תוך 60 יום מרגע הגשת התביעה." },
    { q:"כמה עולה הייצוג?", a:"₪0 מראש. שכר הטרחה הוא אחוזים קבועים בחוק (8%–13% בפלת\"ד) ומשולם רק מתוך הפיצוי שתקבל. אם אין פיצוי — אין תשלום." },
    { q:"תאונה קלה ללא שברים — מגיע לי פיצוי?", a:"בהחלט. גם צליפת שוט (Whiplash) מזכה באלפי שקלים. כל פגיעה גופנית בתאונה מזכה בבדיקת זכאות לפיצוי." },
  ];

  const attorneyBullets = [
    "25 שנות ניסיון בפלת״ד ונזקי גוף",
    "עוסק בניהול תביעות מול כל חברות הביטוח",
    "שכר טרחה על בסיס הצלחה בלבד",
    "זמינות אישית ישירה לכל לקוח",
  ];

  return (
    <div style={{ fontFamily:"'Heebo',Arial,sans-serif", direction:"rtl", background:"#ffffff", color:"#0a2240", overflowX:"hidden" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        a{text-decoration:none;color:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#dde3ea;border-radius:2px}
        .nl{color:#ffffff;font-size:15px;font-weight:500;border-bottom:2px solid transparent;transition:all .2s}
        .nl:hover{color:#ffffff;border-bottom-color:#ffffff}
        @keyframes phonePulse{0%,100%{box-shadow:0 0 0 0 rgba(244,163,0,0.5)}50%{box-shadow:0 0 0 10px rgba(244,163,0,0)}}
        .phone-pulse{animation:phonePulse 2s ease-in-out infinite}
        .card{background:#ffffff;border:1px solid #e0e0e0;border-radius:18px;padding:28px 24px;transition:all .3s;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
        .card:hover{border-color:#2a7ab555;transform:translateY(-4px)}
        .step{background:#f8f9fb;border:1px solid #dde3ea;border-radius:18px;padding:28px 24px}
        .wa-btn{position:fixed;bottom:24px;left:24px;background:#25d366;color:#fff;border:none;border-radius:50%;width:60px;height:60px;min-width:48px;min-height:48px;font-size:26px;cursor:pointer;box-shadow:0 8px 24px #25d36655;z-index:99;display:flex;align-items:center;justify-content:center;transition:transform .2s}
        .wa-btn:hover{transform:scale(1.1)}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .div{width:56px;height:3px;background:#2a7ab5;border-radius:2px;margin:0 auto 14px}
        .pulse{animation:p 2s ease-in-out infinite}
        @keyframes p{0%,100%{opacity:1}50%{opacity:.5}}
        .ck{position:fixed;bottom:0;right:0;left:0;background:#ffffff;border-top:1px solid #dde3ea;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;z-index:98;font-size:13px;color:#7a8fa5}
        @media(min-width:769px){.hero-wrap{max-width:1200px!important;padding:60px 80px!important}.hero-bullets{font-size:1.2rem!important;max-width:800px!important;margin:0 auto 32px!important}.sect-inner{max-width:1200px!important}}
        @media(max-width:768px){.g2,.g3{grid-template-columns:1fr}.g4{grid-template-columns:1fr 1fr}.hm{display:none!important}}
        @media(max-width:480px){.g4{grid-template-columns:1fr 1fr}}
      `}</style>

      {/* SKIP NAV */}
      <a href="#main-content" style={{ position:"absolute", top:-40, right:0, background:G, color:"#ffffff", padding:"8px 16px", borderRadius:"0 0 8px 0", fontSize:14, fontWeight:700, zIndex:999, transition:"top .2s" }} onFocus={e => e.target.style.top = "0"} onBlur={e => e.target.style.top = "-40px"}>דלג לתוכן הראשי</a>

      {/* URGENCY BANNER */}
      {showBanner && (
        <div style={{ position:"fixed", top:0, right:0, left:0, width:"100%", boxSizing:"border-box", zIndex:110, background:G, color:"#ffffff", height:40, display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:14, fontWeight:700, padding:"0 12px" }}>
          <span style={{ flex:1, textAlign:"center" }}>תביעות פלת״ד — חשב ודע מיד כמה מגיע לך</span>
          <button onClick={() => setShowBanner(false)} aria-label="סגור באנר" style={{ background:"transparent", border:"none", color:"#ffffff", fontSize:18, cursor:"pointer", lineHeight:1, fontWeight:900, flexShrink:0 }}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <header role="banner" style={{ position:"fixed", top:showBanner ? 40 : 0, right:0, left:0, zIndex:100, background:scrolled ? "#0a2240" : "#0a2240", backdropFilter:scrolled ? "blur(12px)" : "none", borderBottom:scrolled ? "1px solid #1a4a7a" : "1px solid transparent", transition:"all .3s", padding: isMobile ? "0 8px" : "0 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", minHeight: isMobile ? 52 : 80, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" aria-label="ניפגעתי — עמוד בית" style={{ display:"flex", alignItems:"center" }}>
            <img src="/logo.png" alt="nifgati" width={isMobile ? 112 : 225} height={isMobile ? 28 : 56} style={{ height: isMobile ? 28 : 56, width:"auto", objectFit:"contain" }} />
          </a>
          <nav role="navigation" aria-label="ניווט ראשי" style={{ display:"flex", gap:32, alignItems:"center" }} className="hm">
            {nav.map(n => <a key={n.l} href={n.h} className="nl">{n.l}</a>)}
            <a
              href="/rashlanut-refuit"
              className="nl"
              style={{ display:"inline-flex", alignItems:"center", gap:4 }}
              onClick={() => {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ event: 'cross_domain_nav', from: 'homepage', to: 'medical' });
              }}
            >
              רשלנות רפואית
              <span aria-hidden="true" style={{ fontSize:11, opacity:.75 }}>↖</span>
            </a>
          </nav>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <a href="tel:0544338212" aria-label="התקשר אלינו" className="phone-pulse" onClick={() => { window.dataLayer=window.dataLayer||[]; window.dataLayer.push({event:'phone_click',event_category:'engagement',event_label:'phone_button'}); }} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:48, height:48, background:"#F4A300", backgroundColor:"#F4A300", borderRadius:12, color:"#ffffff", border:"none", fontSize:22, textDecoration:"none", flexShrink:0 }}>📞</a>
            <button style={{ background:"#F4A300", color:"#ffffff", border:"none", borderRadius:8, fontFamily:"inherit", fontWeight:800, fontSize: isMobile ? 14 : 16, padding:"10px 20px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }} onClick={openBot} aria-label="בדיקת פיצוי חינם">בדיקת פיצוי חינם</button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main id="main-content" role="main">

        {/* HERO */}
        <section id="hero" aria-label="עמוד ראשי" style={{ display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", paddingTop:showBanner ? 120 : 80, background:"#0a2240", minHeight: isMobile ? "100vh" : "80vh" }}>
          <div className="hero-wrap" style={{ maxWidth:700, margin:"0 auto", padding:"48px 24px 48px", width:"100%", textAlign:"center" }}>

              <h1 className="ht" style={{ fontSize:"clamp(36px, 8vw, 64px)", fontWeight:800, lineHeight:1.2, marginBottom:18, textShadow:"0 2px 12px rgba(0,0,0,0.3)" }}>
                <span style={{ color:"#ffffff" }}>גלה כמה מגיע לך</span><br />
                <span style={{ color:"#F4A300" }}>לפי החוק</span>
              </h1>

              <p style={{ fontSize:"clamp(16px, 2.5vw, 20px)", fontWeight:400, color:"rgba(255,255,255,0.85)", lineHeight:1.8, maxWidth:500, margin:"0 auto 32px", padding:"0 12px" }}>
                הבוט היחיד בישראל שמחשב פיצוי לפי הנוסחה הסטטוטורית של חוק פלת"ד.
              </p>

              <button onClick={openBot} aria-label="בדוק כמה מגיע לך פיצוי" style={{ display:"block", margin:"0 auto", background:"#F4A300", color:"#ffffff", fontSize:20, fontWeight:700, fontFamily:"inherit", padding:"18px 48px", borderRadius:50, border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(244,163,0,0.4)", transition:"all .2s" }}>בדוק כמה מגיע לך פיצוי — תוך 2 דקות</button>

              <div style={{ display:"flex", gap:16, justifyContent:"center", fontSize:14, color:"rgba(255,255,255,0.7)", marginTop:16 }}>
                <span>🔒 אנונימי</span>
                <span>🤫 לא נשמר</span>
                <span>⚡ תוך 2 דקות</span>
              </div>
          </div>
        </section>



        {/* HOW */}
        <section id="how" aria-label="איך זה עובד" style={{ padding:"68px 24px", background:"#f8f9fb" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:1100, margin:"0 auto" }}>
              <div style={{ textAlign:"center", marginBottom:48 }}>
                <div className="div" aria-hidden="true" />
                <h2 style={{ fontSize:32, fontWeight:900, marginBottom:10 }}>איך זה עובד</h2>
                <p style={{ color:"#7a8fa5", fontSize:15 }}>מהרגע שפנית ועד שהפיצוי בחשבון</p>
              </div>
              <div className="g2" role="list">
                {steps.map(s => (
                  <div key={s.n} className="step" role="listitem">
                    <div style={{ fontSize:40, fontWeight:900, color:G, opacity:.15, lineHeight:1, marginBottom:8 }} aria-hidden="true">{s.n}</div>
                    <h3 style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>{s.t}</h3>
                    <p style={{ fontSize:14, color:"#7a8fa5", lineHeight:1.75 }}>{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* CALCULATOR */}
        <section id="calc" aria-label="מחשבון פיצויים" style={{ padding:"68px 24px" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:680, margin:"0 auto", textAlign:"center" }}>
              <div className="div" aria-hidden="true" />
              <h2 style={{ fontSize:32, fontWeight:900, marginBottom:12 }}>מחשבון פיצויים חינמי</h2>
              <p style={{ color:"#7a8fa5", fontSize:15, marginBottom:36, lineHeight:1.75 }}>
                הבוט מחשב 4 ראשי נזק לפי חוק הפלת"ד — כאב וסבל, הפסדי שכר, אובדן כושר עתידי והוצאות רפואיות.
              </p>
              <div style={{ background:"#f8f9fb", border:"1px solid #dde3ea", borderRadius:20, padding:"36px 32px", marginBottom:20 }}>
                <div style={{ fontSize:48, marginBottom:16 }} aria-hidden="true">🤖</div>
                <h3 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>בוט הפיצויים של nifgati</h3>
                <p style={{ fontSize:14, color:"#7a8fa5", marginBottom:24, lineHeight:1.7 }}>
                  ספר לנו מה קרה ← שאלות חכמות ← חישוב מלא ← ניתוב לוואטסאפ
                </p>
                <button style={{ ...gBtn, fontSize:16, padding:"16px 36px" }} onClick={openBot} aria-label="פתח את בוט הפיצויים">
                  🚀 התחל חישוב עכשיו
                </button>
              </div>
              <p style={{ fontSize:12, color:"#7a8fa5" }}>✓ חינמי &nbsp;|&nbsp; ✓ השיחה לא נשמרת בשרתינו &nbsp;|&nbsp; ✓ ללא התחייבות</p>
            </div>
          </Reveal>
        </section>

        {/* RESULTS STRIP */}
        <section id="results" aria-label="תוצאות אמיתיות" style={{ padding:"68px 24px", background:"#f8f9fb" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:1100, margin:"0 auto" }}>
              <div style={{ textAlign:"center", marginBottom:48 }}>
                <div className="div" aria-hidden="true" />
                <h2 style={{ fontSize:32, fontWeight:900, marginBottom:10 }}>תוצאות אמיתיות של לקוחותינו</h2>
              </div>
              <div className="g3" role="list">
                {results.map(r => (
                  <div key={r.type} className="card" role="listitem" style={{ textAlign:"center" }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>{r.icon}</div>
                    <h3 style={{ fontSize:17, fontWeight:800, marginBottom:6 }}>{r.type}</h3>
                    <div style={{ fontSize:14, color:"#7a8fa5", marginBottom:8 }}>{r.disability}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:G }}>✓ {r.badge}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* REVIEWS */}
        <section id="why" aria-label="ביקורות לקוחות" style={{ padding:"68px 24px" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:1100, margin:"0 auto" }}>
              <div style={{ textAlign:"center", marginBottom:48 }}>
                <div className="div" aria-hidden="true" />
                <h2 style={{ fontSize:32, fontWeight:900, marginBottom:10 }}>לקוחות מספרים</h2>
              </div>
              <div className="g3">
                {reviews.map(r => (
                  <article key={r.n} className="card" aria-label={`ביקורת מאת ${r.n}`}>
                    <div style={{ color:"#F4A300", fontSize:18, letterSpacing:2, marginBottom:10 }} aria-label="5 כוכבים">★★★★★</div>
                    <blockquote style={{ fontSize:14, color:"#2d2d2d", lineHeight:1.75, marginBottom:16, fontStyle:"italic", fontWeight:500 }}>"{r.t}"</blockquote>
                    <footer style={{ display:"flex", justifyContent:"space-between" }}>
                      <cite style={{ fontSize:13, fontWeight:700, fontStyle:"normal", color:"#1a1a2e" }}>{r.n}</cite>
                      <span style={{ fontSize:12, color:"#444444" }}>{r.c}</span>
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ATTORNEY SECTION */}
        <section aria-label="אודות עורך הדין" style={{ padding:"68px 24px", background:"#f8f9fb" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:700, margin:"0 auto", textAlign:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <h2 style={{ fontSize:28, fontWeight:700, marginBottom:18, color:"#1a1a2e", textAlign:"center" }}>עו״ד דן אלון</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:12, alignItems:"center" }}>
                  {attorneyBullets.map(b => (
                    <div key={b} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:17, color:"#1a1a2e", lineHeight:2, fontWeight:500 }}>
                      <span style={{ color:"#2255a4", fontWeight:700, flexShrink:0, fontSize:18 }}>✓</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                <button style={{ ...gBtn, display:"block", margin:"24px auto 0 auto" }} onClick={openBot} aria-label="בדיקת פיצוי">💬 בדיקת פיצוי חינם</button>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" aria-label="שאלות נפוצות" style={{ padding:"68px 24px" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:700, margin:"0 auto" }}>
              <div style={{ textAlign:"center", marginBottom:48 }}>
                <div className="div" aria-hidden="true" />
                <h2 style={{ fontSize:32, fontWeight:900, marginBottom:10 }}>שאלות נפוצות</h2>
              </div>
              <div style={{ borderTop:"1px solid #dde3ea" }}>
                {faqItems.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
              </div>
            </div>
          </Reveal>
        </section>

        {/* CONTACT */}
        <section id="contact" aria-label="צור קשר" style={{ padding:"68px 24px", background:"#f8f9fb" }}>
          <Reveal>
            <div className="sect-inner" style={{ maxWidth:500, margin:"0 auto", textAlign:"center" }}>
              <div className="div" aria-hidden="true" />
              <h2 style={{ fontSize:32, fontWeight:900, marginBottom:12 }}>דברו איתנו עכשיו</h2>
              <p style={{ color:"#7a8fa5", fontSize:15, marginBottom:36 }}>ייעוץ ראשוני חינמי, ללא התחייבות</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <button style={{ ...gBtn, width:"100%", justifyContent:"center", fontSize:16, padding:16 }} onClick={openBot} aria-label="פתח מחשבון פיצויים">🤖 בדוק כמה מגיע לך פיצוי — תוך 2 דקות</button>
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
          </Reveal>
        </section>

      </main>

      {/* FOOTER */}
      <footer role="contentinfo" style={{ background:"#0a2240", borderTop:"1px solid #1a4a7a", padding:"24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div style={{ fontSize:13, color:"#ffffffbb" }}>© 2025 nifgati.co.il | {MY_NAME}, עו״ד נזיקין (25 שנות ניסיון)</div>
          <nav aria-label="קישורי מדיניות" style={{ display:"flex", gap:20 }}>
            <a href="/privacy" style={{ fontSize:12, color:"#ffffffbb", textDecoration:"underline" }}>מדיניות פרטיות</a>
            <a href="/accessibility" style={{ fontSize:12, color:"#ffffffbb", textDecoration:"underline" }}>נגישות</a>
            <a href="#" style={{ fontSize:12, color:"#ffffffbb", textDecoration:"underline" }}>תנאי שימוש</a>
          </nav>
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:"#ffffff88", marginTop:12 }}>
          האתר אינו מהווה ייעוץ משפטי. כל מקרה נבחן באופן אישי. | שיחות הבוט אינן נשמרות ואינן מתועדות בשום אופן.
        </p>
      </footer>

      {/* WhatsApp float */}
      <button className="wa-btn" onClick={() => openWhatsApp(window.location.pathname)} aria-label="פתח שיחת וואטסאפ">💬</button>

      {/* Cookie Banner */}
      {!cookie && (
        <div style={{ position:"fixed", bottom:80, right:0, left:0, background:"#ffffffee", borderTop:"1px solid #dde3ea", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, zIndex:9999, fontSize:12, color:"#0a2240" }}>
          <span>האתר משתמש בעוגיות Remarketing בלבד. שיחות הבוט אינן נשמרות. <a href="/privacy" style={{ color:"#2a7ab5", textDecoration:"underline" }}>פרטיות</a></span>
          <button style={{ background:"#0a224022", color:"#0a2240", border:"1px solid #0a224044", borderRadius:10, fontFamily:"inherit", fontSize:14, padding:"14px 28px", cursor:"pointer", flexShrink:0, minHeight:48, minWidth:48 }} onClick={() => { setCookie(true); sessionStorage.setItem("nifgati_consent","granted"); window.dataLayer = window.dataLayer || []; window.dataLayer.push({event:'consent_update','analytics_storage':'granted','ad_storage':'granted'}); }}>אישור ✓</button>
        </div>
      )}

      {/* EXIT INTENT POPUP */}
      {showExit && (
        <div role="dialog" aria-modal="true" aria-label="לפני שאתה עוזב" style={{ position:"fixed", inset:0, background:"#0a2240cc", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#ffffff", border:`2px solid ${G}`, borderRadius:20, padding:"36px 32px", maxWidth:420, width:"100%", textAlign:"center", position:"relative" }}>
            <button onClick={() => setShowExit(false)} aria-label="סגור" style={{ position:"absolute", top:12, left:12, background:"transparent", border:"none", color:"#7a8fa5", fontSize:20, cursor:"pointer", lineHeight:1 }}>✕</button>
            <h2 style={{ fontSize:24, fontWeight:900, marginBottom:10, color:"#0a2240" }}>רגע לפני שאתה עוזב... 👋</h2>
            <p style={{ fontSize:15, color:"#7a8fa5", marginBottom:28, lineHeight:1.6 }}>גלה כמה פיצוי מגיע לך — לוקח 60 שניות</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button onClick={() => { setShowExit(false); openBot(); }} style={{ ...gBtn, width:"100%", justifyContent:"center", fontSize:16, padding:16 }} aria-label="פתח מחשבון פיצויים">⚡ פתח מחשבון פיצויים</button>
              <button onClick={() => openWhatsApp("exit_intent")} style={{ ...oBtn, width:"100%", justifyContent:"center", fontSize:16, padding:16, background:"#0a224015", borderColor:"#0a224088", color:"#0a2240" }} aria-label="וואטסאפ עכשיו">💬 וואטסאפ עכשיו</button>
            </div>
          </div>
        </div>
      )}

      {/* Bot */}
      {showBot && <Suspense fallback={<div style={{position:"fixed",inset:0,background:"#0a2240cc",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",color:"#ffffff",fontSize:18,fontWeight:700}}>טוען...</div>}><Bot onClose={() => setShowBot(false)} /></Suspense>}
    </div>
  );
}
