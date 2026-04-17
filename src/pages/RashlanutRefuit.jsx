import { useState, useEffect, lazy, Suspense } from "react";
import { captureGclid } from "../utils/gclid.js";
import { sendToCrm } from "../utils/crm.js";

const MedicalBot = lazy(() => import("../MedicalBot.jsx"));

const PHONE    = "0544338212";
const WA_PHONE = "972544338212";
const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";
const WA_MSG   = "שלום, אני מעוניין בבדיקת זכאות לפיצוי בגין רשלנות רפואית";
const WA_URL   = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(WA_MSG)}`;
const PAGE_URL = "https://nifgati.co.il/rashlanut-refuit";

// dir="rtl" and lang="he" are set globally on <html> in index.html,
// but we re-declare on the wrapper so the page is self-contained.

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
      <div style={{ maxHeight:open?400:0,overflow:"hidden",transition:"max-height .4s ease" }}>
        <p style={{ fontSize:14,color:"#5a6a7a",lineHeight:1.9,paddingBottom:18 }}>{a}</p>
      </div>
    </div>
  );
}

const faqItems = [
  {
    q: "מה נחשב רשלנות רפואית?",
    a: "רשלנות רפואית מתקיימת כאשר מטפל סוטה מרמת הזהירות המקובלת במקצוע וגורם לנזק לחולה. התשובה תלויה בנסיבות המקרה ובנתונים הרפואיים, וכל מקרה נבחן לגופו לאור חוות דעת רפואית מתאימה."
  },
  {
    q: "האם יש לי סיכוי לזכות בתביעה?",
    a: "אין דרך להתחייב לתוצאה מראש. הסיכוי תלוי בחומרת הסטייה מהסטנדרט הרפואי, בהוכחת הקשר הסיבתי בין הטיפול לנזק ובמידת הנזק. בדיקה פרטנית של המסמכים הרפואיים וחוות דעת של מומחה בתחום הרלוונטי הן תנאי להערכה מושכלת."
  },
  {
    q: "כמה זמן נמשך הליך כזה?",
    a: "הליכים של רשלנות רפואית נמשכים בדרך כלל זמן ממושך - לעתים מספר שנים - משום שהם מחייבים איסוף תיעוד רפואי, חוות דעת של מומחים ומהלך משפטי מלא. משך הזמן המדויק משתנה בהתאם למורכבות המקרה, לעומס בתי המשפט ולעמדת הצד שכנגד."
  },
  {
    q: "האם אני צריך חוות דעת רפואית?",
    a: "כן. תביעת רשלנות רפואית בישראל דורשת חוות דעת של רופא מומחה בתחום הרלוונטי, המצביעה על סטייה מהסטנדרט הרפואי ועל הקשר הסיבתי לנזק. חוות דעת זו היא אבן יסוד של התיק ומוגשת לצד כתב התביעה."
  },
  {
    q: "מה עולה לייצג אותי?",
    a: "ייצוג בתביעות רשלנות רפואית מבוסס לרוב על שכר טרחה על בסיס הצלחה - תשלום כאחוז מהפיצוי אם וכאשר מתקבל. הוצאות נלוות, כמו עלות חוות הדעת הרפואית, נבחנות מראש. פרטים מדויקים נקבעים בשיחת ייעוץ ראשונית, לפי נתוני המקרה."
  },
  {
    q: "מה ההבדל בין סיבוך רפואי לרשלנות?",
    a: "לא כל תוצאה קשה של טיפול היא רשלנות. סיבוך רפואי הוא אירוע מוכר וצפוי שיכול להתרחש גם בטיפול תקין. רשלנות מתקיימת רק כאשר היה כשל בסטנדרט הטיפולי - בפעולה, באבחון או בקבלת הסכמה מדעת - שהוביל לנזק. ההבחנה דורשת בדיקה פרטנית של עורך דין וחוות דעת רפואית מתאימה."
  }
];

function trackWhatsAppClick(buttonLocation) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'whatsapp_click',
    domain: 'medical',
    page_type: 'landing_general',
    button_location: buttonLocation || 'rashlanut-refuit'
  });
  const params = new URLSearchParams(window.location.search);
  sendToCrm({
    page: '/rashlanut-refuit',
    whatsappClick: true,
    utmSource: params.get("utm_source") || "",
  });
}

function openMedicalWhatsApp(buttonLocation) {
  trackWhatsAppClick(buttonLocation);
  window.open(WA_URL, "_blank", "noopener,noreferrer");
}

export default function RashlanutRefuit() {
  const [scrolled, setScrolled]     = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [isMobile, setIsMobile]     = useState(window.innerWidth <= 768);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    captureGclid();
  }, []);

  useEffect(() => {
    const title = "רשלנות רפואית - בדיקת זכאות לפיצוי | נפגעתי";
    const desc  = "נפגעת מטיפול רפואי לקוי? בדיקת זכאות לפיצוי בגין רשלנות רפואית - איחור באבחון, טעויות ניתוחיות, פגיעה בלידה, שגיאות תרופתיות. ייעוץ ראשוני חינם.";

    const prevTitle = document.title;
    document.title = title;

    const descEl = document.querySelector('meta[name="description"]');
    const prevDesc = descEl ? descEl.getAttribute("content") : null;
    if (descEl) descEl.setAttribute("content", desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    const canonicalExisted = !!canonical;
    const prevCanonical = canonical ? canonical.getAttribute("href") : null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", PAGE_URL);

    return () => {
      document.title = prevTitle;
      if (descEl && prevDesc !== null) descEl.setAttribute("content", prevDesc);
      if (!canonicalExisted) canonical.remove();
      else if (prevCanonical !== null) canonical.setAttribute("href", prevCanonical);
    };
  }, []);

  useEffect(() => {
    const legalServiceSchema = {
      "@context": "https://schema.org",
      "@type": "LegalService",
      "name": "דן אלון — עורך דין רשלנות רפואית",
      "alternateName": "nifgati",
      "url": PAGE_URL,
      "telephone": "+972-54-4338212",
      "email": "Danalonadv@gmail.com",
      "description": "עורך דין רשלנות רפואית - בדיקת זכאות לפיצוי במקרים של איחור באבחון, טעויות ניתוחיות, פגיעה בלידה, שגיאות תרופתיות והעדר הסכמה מדעת.",
      "serviceType": "תביעות רשלנות רפואית",
      "knowsAbout": ["רשלנות רפואית", "איחור באבחון", "טעויות ניתוחיות", "פגיעה בלידה", "שגיאות תרופתיות", "הסכמה מדעת"],
      "areaServed": { "@type": "Country", "name": "Israel" },
      "priceRange": "שכר טרחה על בסיס הצלחה",
      "openingHours": "Mo-Th 09:00-19:00",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "חנה זמר 7",
        "addressLocality": "תל אביב",
        "addressCountry": "IL"
      }
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a }
      }))
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "דף הבית", "item": "https://nifgati.co.il" },
        { "@type": "ListItem", "position": 2, "name": "רשלנות רפואית", "item": PAGE_URL }
      ]
    };

    const entries = [
      { id: "nifgati-rashlanut-legalservice", schema: legalServiceSchema },
      { id: "nifgati-rashlanut-faq",          schema: faqSchema },
      { id: "nifgati-rashlanut-breadcrumb",   schema: breadcrumbSchema },
    ];

    entries.forEach(({ id, schema }) => {
      if (document.getElementById(id)) return;
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      el.textContent = JSON.stringify(schema);
      document.head.appendChild(el);
    });

    return () => {
      entries.forEach(({ id }) => document.getElementById(id)?.remove());
    };
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const G = "#0a2240";
  const BLUE = "#1a4a7a";
  const ACCENT = "#2a7ab5";

  const waBtn = {
    background:"#25d366", color:"#ffffff", border:"none", borderRadius:14,
    fontFamily:"inherit", fontWeight:800, fontSize:17, padding:"16px 30px",
    cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center",
    gap:10, boxShadow:"0 6px 18px rgba(37,211,102,0.35)", transition:"transform .15s"
  };
  const phoneBtn = {
    background:"transparent", color:G, border:`1.5px solid ${G}`, borderRadius:14,
    fontFamily:"inherit", fontWeight:700, fontSize:16, padding:"15px 28px",
    cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center",
    gap:8, textDecoration:"none"
  };

  return (
    <div dir="rtl" lang="he" style={{ fontFamily:"'Heebo',Arial,sans-serif", direction:"rtl", background:"#ffffff", color:"#0a2240", overflowX:"hidden", minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        a{text-decoration:none;color:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#dde3ea;border-radius:2px}
        .nl{color:#ffffff;font-size:15px;font-weight:500;border-bottom:2px solid transparent;transition:all .2s}
        .nl:hover{color:#ffffff;border-bottom-color:#ffffff}
        .hm{display:flex}
        @media(max-width:768px){.hm{display:none!important}}
        .wa-btn-float{position:fixed;bottom:24px;left:24px;background:#25d366;color:#fff;border:none;border-radius:50%;width:56px;height:56px;font-size:24px;cursor:pointer;box-shadow:0 8px 24px #25d36655;z-index:99;display:flex;align-items:center;justify-content:center;transition:transform .2s}
        .wa-btn-float:hover{transform:scale(1.1)}
        .rr-prose p{font-size:16px;line-height:1.95;color:#2d3e52;margin-bottom:14px}
        .rr-prose p:last-child{margin-bottom:0}
        .rr-h2{font-size:clamp(22px,3.8vw,30px);font-weight:900;color:#0a2240;margin-bottom:18px;position:relative;padding-bottom:10px}
        .rr-h2::after{content:"";position:absolute;bottom:0;right:0;width:48px;height:3px;background:#2a7ab5;border-radius:2px}
        @media(max-width:768px){.rr-cta-row{flex-direction:column!important;align-items:stretch!important}.rr-cta-row>*{width:100%!important}}
      `}</style>

      {/* SKIP NAV */}
      <a href="#main-content" style={{ position:"absolute", top:-40, right:0, background:G, color:"#ffffff", padding:"8px 16px", borderRadius:"0 0 8px 0", fontSize:14, fontWeight:700, zIndex:999, transition:"top .2s" }} onFocus={e => e.target.style.top = "0"} onBlur={e => e.target.style.top = "-40px"}>דלג לתוכן הראשי</a>

      {/* URGENCY BANNER */}
      {showBanner && (
        <div style={{ position:"fixed", top:0, right:0, left:0, width:"100%", boxSizing:"border-box", zIndex:110, background:G, color:"#ffffff", height:40, display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:14, fontWeight:700, padding:"0 12px" }}>
          <span style={{ flex:1, textAlign:"center" }}>רשלנות רפואית - ייעוץ ראשוני חינם, ללא התחייבות</span>
          <button onClick={() => setShowBanner(false)} aria-label="סגור באנר" style={{ background:"transparent", border:"none", color:"#ffffff", fontSize:18, cursor:"pointer", lineHeight:1, fontWeight:900, flexShrink:0 }}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <header role="banner" style={{ position:"fixed", top:showBanner ? 40 : 0, right:0, left:0, zIndex:100, background:"#0a2240", backdropFilter:scrolled ? "blur(12px)" : "none", borderBottom:scrolled ? `1px solid ${BLUE}` : "1px solid transparent", transition:"all .3s", padding: isMobile ? "0 8px" : "0 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", height: isMobile ? 52 : 64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" aria-label="nifgati — עמוד בית" style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/logo.png" alt="nifgati" width={isMobile ? 112 : 225} height={isMobile ? 28 : 56} style={{ height: isMobile ? 28 : 56, width:"auto", objectFit:"contain" }} />
          </a>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <nav role="navigation" aria-label="ניווט" className="hm" style={{ gap:32, alignItems:"center" }}>
              <a
                href="/"
                className="nl"
                onClick={() => {
                  window.dataLayer = window.dataLayer || [];
                  window.dataLayer.push({ event: 'cross_domain_nav', from: 'medical', to: 'homepage' });
                }}
              >
                תאונות דרכים
              </a>
            </nav>
            <a href={`tel:${PHONE}`} aria-label="התקשר אלינו" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, background:"#0a2240", borderRadius: isMobile ? 10 : 14, color:"#ffffff", border:`1px solid ${BLUE}`, fontSize: isMobile ? 17 : 22, textDecoration:"none", flexShrink:0, boxShadow:"0 2px 8px #0a224055" }}>📞</a>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main id="main-content" role="main" style={{ flex:1 }}>

        {/* HERO */}
        <section aria-label="רשלנות רפואית - בדיקת זכאות לפיצוי" style={{ position:"relative", overflow:"hidden", paddingTop:showBanner ? 120 : 80, paddingBottom:40, background:"linear-gradient(180deg,#f5f8fc 0%,#ffffff 100%)" }}>
          <div style={{ maxWidth:860, margin:"0 auto", padding:"40px 24px 24px", width:"100%", textAlign:"center" }}>
            <h1 style={{ fontSize:"clamp(26px, 6vw, 48px)", fontWeight:900, lineHeight:1.25, marginBottom:18, color:G, letterSpacing:"-0.01em" }}>
              רשלנות רפואית - בדיקת זכאות לפיצוי
            </h1>
            <p style={{ fontSize:"clamp(15px, 2.2vw, 19px)", fontWeight:500, color:"#2d3e52", marginBottom:32, lineHeight:1.8, maxWidth:720, margin:"0 auto 32px" }}>
              אם נפגעת מטיפול רפואי - איחור באבחון, טעות ניתוחית, פגיעה בלידה, שגיאה תרופתית או כשל אחר - ייתכן שמגיעה לך בדיקת זכאות לפיצוי. כל מקרה נבחן לגופו, לאחר עיון בתיעוד הרפואי ובחוות דעת של מומחה מתאים.
            </p>
            <div className="rr-cta-row" style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:14 }}>
              <button onClick={() => openMedicalWhatsApp('hero')} style={waBtn} aria-label="פתח וואטסאפ לבדיקת זכאות">
                <span aria-hidden="true">💬</span>
                <span>בדיקת זכאות בוואטסאפ</span>
              </button>
              <a href={`tel:${PHONE}`} style={phoneBtn} aria-label={`התקשר: ${PHONE}`} onClick={() => { window.dataLayer=window.dataLayer||[]; window.dataLayer.push({event:'phone_click',domain:'medical',page_type:'landing_general',button_location:'hero'}); }}>
                <span aria-hidden="true">📞</span>
                <span>{PHONE}</span>
              </a>
            </div>
            <p style={{ fontSize:13, color:"#7a8fa5", marginTop:16 }}>
              ✓ ייעוץ ראשוני חינם &nbsp;•&nbsp; ✓ דיסקרטיות מלאה &nbsp;•&nbsp; ✓ בחינה פרטנית של כל מקרה
            </p>
          </div>
        </section>

        {/* SECTION 1: מהי רשלנות רפואית? */}
        <section style={{ padding:"56px 24px", background:"#ffffff" }}>
          <div style={{ maxWidth:760, margin:"0 auto" }}>
            <h2 className="rr-h2">מהי רשלנות רפואית?</h2>
            <div className="rr-prose">
              <p>
                רשלנות רפואית היא סטייה של מטפל - רופא, אחות, מוסד רפואי או מטפל מקצועי אחר - מרמת הזהירות והמיומנות הסבירה המצופה ממנו, באופן שגרם נזק למטופל. המסגרת המשפטית בישראל נשענת בעיקר על פקודת הנזיקין [נוסח חדש], שמגדירה את עילות הרשלנות, ועל חוק זכויות החולה, התשנ"ו-1996, שמעגן את זכויות המטופל ואת חובת קבלת ההסכמה מדעת לטיפול.
              </p>
              <p>
                על מנת שתיבחן עילת תביעה, נדרש בדרך כלל להראות שהתקיימה סטייה מהסטנדרט המקצועי המקובל, שנגרם נזק בפועל ושקיים קשר סיבתי בין השניים. ההכרעה בכל אחד מהרכיבים האלה היא לעולם פרטנית ונעשית על סמך התיעוד הרפואי וחוות דעת של רופא מומחה בתחום הרלוונטי.
              </p>
            </div>
          </div>
        </section>

        {/* BOT: בדיקה ראשונית */}
        <section id="bot" aria-label="בדיקה ראשונית" style={{ padding:"40px 16px 48px", background:"#eef3f8" }}>
          <Suspense fallback={<div style={{ minHeight:340, maxWidth:680, margin:"0 auto", background:"#ffffff", border:"1px solid #dde3ea", borderRadius:18 }} />}>
            <MedicalBot />
          </Suspense>
        </section>

        {/* SECTION 2: סוגי מקרים */}
        <section style={{ padding:"56px 24px", background:"#f8f9fb" }}>
          <div style={{ maxWidth:760, margin:"0 auto" }}>
            <h2 className="rr-h2">סוגי מקרים שאנחנו מטפלים בהם</h2>
            <div className="rr-prose">
              <p>
                אנו עוסקים במגוון רחב של מקרים בתחום הרשלנות הרפואית, וביניהם איחור באבחון מחלות ומצבים רפואיים, טעויות ניתוחיות וסיבוכים הנובעים מכשל בפעולה המקצועית, פגיעה בלידה של אם או יילוד, שגיאות תרופתיות במתן מינון שגוי או תרופה לא מתאימה, העדר הסכמה מדעת - כלומר טיפול שבוצע מבלי שהמטופל קיבל הסבר מלא וסביר על הסיכונים, החלופות והסיכויים - וכן מקרים של תיעוד רפואי לקוי שפוגע ביכולת לעקוב אחר הטיפול ולקבל החלטות קליניות מתאימות.
              </p>
              <p>
                לכל קטגוריה מאפיינים משלה, דרישות ראייתיות שונות ומומחיות רפואית נדרשת אחרת. גם בתוך אותה קטגוריה, התוצאה של בדיקת הזכאות תלויה בנתוני המקרה הספציפי, בתיעוד הקיים ובחוות הדעת של המומחה.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: תוך כמה זמן */}
        <section style={{ padding:"56px 24px", background:"#ffffff" }}>
          <div style={{ maxWidth:760, margin:"0 auto" }}>
            <h2 className="rr-h2">תוך כמה זמן אפשר לתבוע?</h2>
            <div className="rr-prose">
              <p>
                תקופת ההתיישנות הכללית לתביעות נזיקין בישראל, ובכלל זה תביעות רשלנות רפואית, היא 7 שנים. עם זאת, מועד תחילת מניין התקופה אינו אחיד - במקרים מסוימים הוא נספר ממועד הטיפול או האירוע, ובאחרים ממועד גילוי הנזק או מועד התגבשותו, בהתאם לנסיבות. בתביעות של קטינים קיימים כללים מיוחדים שמאריכים את התקופה הזו.
              </p>
              <p>
                מאחר שהשאלה מתי החל מניין ההתיישנות במקרה קונקרטי היא שאלה משפטית-עובדתית המשתנה ממקרה למקרה, מומלץ לפנות לבדיקה בהקדם האפשרי ולא להסתמך על חישוב עצמי של תאריך הגשה אחרון.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: למה נפגעתי? */}
        <section style={{ padding:"56px 24px", background:"#f8f9fb" }}>
          <div style={{ maxWidth:760, margin:"0 auto" }}>
            <h2 className="rr-h2">למה נפגעתי?</h2>
            <div className="rr-prose">
              <p>
                תחום הרשלנות הרפואית דורש שילוב של הבנה משפטית והיכרות עם המערכת הרפואית, עבודה צמודה עם רופאים מומחים לצורך הכנת חוות דעת והתמודדות מול חברות ביטוח, מוסדות רפואיים וגופים ציבוריים. אנו ניגשים לכל תיק באופן אישי, לאחר עיון בתיעוד הרפואי והיכרות עם סיפורו של המטופל ומשפחתו.
              </p>
              <p>
                הייעוץ הראשוני ניתן ללא עלות וללא התחייבות, במטרה לבחון יחד האם קיימת עילת תביעה סבירה והאם שווה להשקיע בהכנת חוות דעת רפואית. ההחלטה אם להמשיך בהליך נותרת תמיד בידיך, על בסיס מידע מלא ושקוף.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-label="שאלות נפוצות" style={{ padding:"56px 24px", background:"#ffffff" }}>
          <div style={{ maxWidth:760, margin:"0 auto" }}>
            <h2 className="rr-h2" style={{ textAlign:"center" }}>שאלות נפוצות</h2>
            <div style={{ borderTop:"1px solid #dde3ea", marginTop:12 }}>
              {faqItems.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section aria-label="צור קשר" style={{ padding:"56px 24px", background:"#f8f9fb" }}>
          <div style={{ maxWidth:520, margin:"0 auto", textAlign:"center" }}>
            <h2 style={{ fontSize:"clamp(22px,3.6vw,28px)", fontWeight:900, marginBottom:12, color:G }}>דברו איתנו עכשיו</h2>
            <p style={{ color:"#5a6a7a", fontSize:15, marginBottom:28, lineHeight:1.7 }}>
              ייעוץ ראשוני חינמי בנושא רשלנות רפואית, ללא התחייבות. כל מקרה נבחן באופן פרטני.
            </p>
            <div className="rr-cta-row" style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button onClick={() => openMedicalWhatsApp('bottom_cta')} style={{ ...waBtn, width:"100%" }} aria-label="פתח וואטסאפ לבדיקת זכאות">
                <span aria-hidden="true">💬</span>
                <span>בדיקת זכאות בוואטסאפ</span>
              </button>
              <a href={`tel:${PHONE}`} style={{ ...phoneBtn, width:"100%" }} aria-label={`התקשר: ${PHONE}`} onClick={() => { window.dataLayer=window.dataLayer||[]; window.dataLayer.push({event:'phone_click',domain:'medical',page_type:'landing_general',button_location:'bottom_cta'}); }}>
                <span aria-hidden="true">📞</span>
                <span>{PHONE} - התקשר עכשיו</span>
              </a>
            </div>
            <address style={{ marginTop:32, fontSize:13, color:"#7a8fa5", lineHeight:2, fontStyle:"normal" }}>
              <div>{MY_NAME} — {MY_TITLE}</div>
              <div>חנה זמר 7, תל אביב</div>
              <div>ימים א׳–ה׳ | 9:00–19:00</div>
              <div><a href="mailto:Danalonadv@gmail.com" style={{ color:ACCENT }}>Danalonadv@gmail.com</a></div>
            </address>
          </div>
        </section>

        {/* LEGAL DISCLAIMER */}
        <section aria-label="הבהרה משפטית" style={{ padding:"36px 24px 56px", background:"#ffffff" }}>
          <div style={{ maxWidth:760, margin:"0 auto" }}>
            <div role="note" style={{ background:"#f5f7fa", border:"1px solid #dde3ea", borderRadius:12, padding:"18px 22px", fontSize:14, lineHeight:1.8, color:"#5a6a7a", textAlign:"right" }}>
              <strong style={{ color:"#0a2240", display:"block", marginBottom:6, fontSize:14 }}>הבהרה חשובה</strong>
              המידע באתר זה אינו מהווה ייעוץ משפטי. כל מקרה נבחן לגופו ודורש בדיקה פרטנית של עורך דין מוסמך וחוות דעת רפואית מתאימה.
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer role="contentinfo" style={{ background:"#0a2240", borderTop:`1px solid ${BLUE}`, padding:"24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div style={{ fontSize:13, color:"#ffffffbb" }}>© 2026 nifgati.co.il | {MY_NAME}, עו״ד נזיקין</div>
          <nav aria-label="קישורי מדיניות" style={{ display:"flex", gap:20 }}>
            <a href="/privacy" style={{ fontSize:12, color:"#ffffffbb" }}>מדיניות פרטיות</a>
            <a href="/accessibility" style={{ fontSize:12, color:"#ffffffbb" }}>נגישות</a>
          </nav>
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:"#ffffff88", marginTop:12 }}>
          האתר אינו מהווה ייעוץ משפטי. כל מקרה נבחן באופן אישי.
        </p>
      </footer>

      {/* Floating WhatsApp */}
      <button className="wa-btn-float" onClick={() => openMedicalWhatsApp('floating')} aria-label="פתח שיחת וואטסאפ">💬</button>
    </div>
  );
}
