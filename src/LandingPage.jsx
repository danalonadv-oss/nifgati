import { useState, useEffect, useRef } from "react";
import Bot from "./Bot.jsx";
import { openWhatsApp } from "./utils/whatsapp.js";
import { captureGclid } from "./utils/gclid.js";

const PHONE    = "0544338212";
const WA       = "972544338212";
const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";

function getPersonalizedOpening(pageSlug, utmTerm) {
  const t = (utmTerm || '').toLowerCase();
  const p = (pageSlug || '').toLowerCase();

  // ── /machshevon ──
  if (p === 'machshevon') {
    if (t.includes('כאב וסבל'))
      return 'כאב וסבל הוא רק חלק מהפיצוי. בוא נחשב את התמונה המלאה — כולל הפסד שכר ונכות.';
    if (t.includes('מחשבון'))
      return 'בוא נחשב ישר — כמה שאלות קצרות ואתן לך הערכת פיצוי מיידית לפי חוק הפלת״ד.';
    if (t.includes('כמה') || t.includes('פיצוי'))
      return 'רוצה לדעת כמה? 3 שאלות ויש לך מספר מדויק.';
    return 'ספר לי מה קרה בתאונה ואחשב כמה מגיע לך לפי החוק.';
  }

  // ── /taonat-drakhim ──
  if (p === 'taonat-drakhim') {
    if (t.includes('פיצויים תאונת דרכים'))
      return 'חיפשת פיצויים על תאונת דרכים — ספר לי מה קרה ואחשב כמה מגיע לך.';
    if (t.includes('נפגעתי'))
      return 'נפגעת בתאונה? בוא נבדוק יחד כמה פיצוי מגיע לך לפי החוק.';
    if (t.includes('ביטוח חובה'))
      return 'מגיע לך יותר ממה שהביטוח יציע. בוא נחשב כמה באמת.';
    if (t.includes('מה עושים'))
      return 'נפגעת בתאונה ולא יודע מה לעשות? הצעד הראשון — לדעת כמה מגיע לך.';
    return 'שלום 👋 ספר לי מה קרה בתאונה ואחשב כמה פיצוי מגיע לך.';
  }

  // ── /nechut ──
  if (p === 'nechut') {
    if (t.includes('10') || t.includes('עשר'))
      return 'חיפשת מה שווה נכות 10%? בוא נחשב בדיוק — זה יכול להיות מאות אלפי שקלים.';
    if (t.includes('20'))
      return 'נכות 20% שווה פיצוי משמעותי מאוד. בוא נחשב כמה מגיע לך.';
    if (t.includes('5') || t.includes('חמש'))
      return 'גם נכות 5% מזכה בעשרות אלפי שקלים. בוא נחשב.';
    if (t.includes('מחשבון'))
      return 'בוא נחשב ישר — כמה שאלות ואתן לך הערכה מיידית לפי אחוזי הנכות שלך.';
    return 'קיבלת אחוז נכות? כל אחוז שווה עשרות אלפי שקלים — ספר לי מה קרה.';
  }

  // ── /ofanoa ──
  if (p === 'ofanoa') {
    if (t.includes('כמה מקבלים'))
      return 'רוצה לדעת כמה מקבלים על תאונת אופנוע? בוא נחשב לפי הפגיעה הספציפית שלך.';
    return 'תאונות אופנוע מזכות לרוב בפיצוי גבוה במיוחד. ספר לי מה קרה ואחשב כמה מגיע לך.';
  }

  // ── /korkinet ──
  if (p === 'korkinet') {
    if (t.includes('אופניים חשמליים'))
      return 'תאונת אופניים חשמליים מכוסה בחוק הפלת״ד. ספר לי מה קרה.';
    return 'תאונת קורקינט? גם כלי רכב קל מכוסה בחוק. ספר לי מה קרה.';
  }

  // ── /avoda ──
  if (p === 'avoda') {
    if (t.includes('דרך לעבודה'))
      return 'תאונה בדרך לעבודה מזכה בפיצוי ממספר מקורות — ביטוח לאומי וגם פלת״ד. בוא נבדוק.';
    return 'נפגעת בתאונת עבודה? מגיע לך פיצוי ממספר מקורות. בוא נבדוק יחד כמה.';
  }

  // ── /holeh-regel ──
  if (p === 'holeh-regel')
    return 'הולכי רגל שנפגעו זכאים לפיצוי מלא — גם ללא אשם. ספר לי מה קרה.';

  // ── /shever ──
  if (p === 'shever') {
    if (t.includes('ברך'))
      return 'פגיעה בברך מזכה בפיצוי על כאב, היעדרות ונזק עתידי. מה קרה?';
    return 'שבר בתאונה מזכה בפיצוי על כאב, היעדרות ונזק עתידי. מה נשבר?';
  }

  // ── /pritzat-disc ──
  if (p === 'pritzat-disc') {
    if (t.includes('גב'))
      return 'כאבי גב אחרי תאונה מוכרים כנזק גוף. ספר לי מה קרה ואחשב כמה מגיע לך.';
    return 'פריצת דיסק בגלל תאונה מזכה בפיצוי משמעותי. ספר לי על הפגיעה.';
  }

  // ── /tzlipat-shot ──
  if (p === 'tzlipat-shot')
    return 'צליפת שוט מוכרת בחוק גם ללא שבר. ספר לי מה קרה בתאונה.';

  // ── /ptsd ──
  if (p === 'ptsd')
    return 'נזק נפשי אחרי תאונה הוא ראש נזק מוכר בחוק. ספר לי מה עברת.';

  // ── default ──
  return 'שלום 👋 נפגעת בתאונה? ספר לי מה קרה ואחשב כמה פיצוי מגיע לך.';
}

// Read utm_term synchronously so it's available on the very first render
// (before Bot mounts and initializes its useState with the opening message)
function readUtmTerm() {
  const raw = new URLSearchParams(window.location.search).get("utm_term");
  if (!raw) return "";
  return decodeURIComponent(raw.replace(/\+/g, " ")).trim();
}

export default function LandingPage({ pageTitle, pageSubtitle, heroEmoji, bullets, ctaText, pageSlug, bannerText, socialProofAmount, socialProofLabel }) {
  const utmTerm = readUtmTerm();

  const [scrolled, setScrolled]     = useState(false);
  const [cookie, setCookie]         = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [isMobile, setIsMobile]     = useState(window.innerWidth <= 768);

  const [dynamicTitle] = useState(() => {
    if (utmTerm.length > 0 && utmTerm.length <= 40) {
      return `נפגעת ב${utmTerm}? מגיע לך פיצוי.`;
    }
    return pageTitle;
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    captureGclid();

    // Analytics: inline bot loaded
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'bot_opened',
      bot_trigger: 'inline_page_load',
      page_slug: pageSlug || '',
      utm_term: utmTerm || '',
    });
  }, []);

  // ── Schema.org structured data per landing page ──
  useEffect(() => {
    const baseSchema = {
      "@context": "https://schema.org",
      "@type": "LegalService",
      "name": "דן אלון — עורך דין נזיקין",
      "alternateName": "nifgati",
      "url": `https://nifgati.co.il/${pageSlug}`,
      "telephone": "+972-54-4338212",
      "email": "Danalonadv@gmail.com",
      "areaServed": { "@type": "Country", "name": "Israel" },
      "priceRange": "8%-13% מהפיצוי בלבד",
      "openingHours": "Mo-Th 09:00-19:00",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "חנה זמר 7",
        "addressLocality": "תל אביב",
        "addressCountry": "IL"
      }
    };

    const pageSchemas = {
      'taonat-drakhim': {
        "description": "עורך דין תאונות דרכים — חישוב פיצוי מיידי לפי חוק הפלת״ד. כאב וסבל, נכות, הפסד שכר.",
        "serviceType": "תביעות פיצויים תאונת דרכים",
        "knowsAbout": ["תאונות דרכים", "פיצויים", "חוק פלת״ד", "כאב וסבל", "נכות"]
      },
      'ofanoa': {
        "description": "עורך דין תאונות אופנוע — פיצויים גבוהים לרוכבי אופנוע שנפגעו בתאונה.",
        "serviceType": "תביעות פיצויים תאונת אופנוע",
        "knowsAbout": ["תאונת אופנוע", "פיצויים", "נכות", "חוק פלת״ד"]
      },
      'korkinet': {
        "description": "עורך דין תאונות קורקינט ואופניים חשמליים — חוק הפיצויים חל גם על כלי רכב קל.",
        "serviceType": "תביעות פיצויים קורקינט ואופניים חשמליים",
        "knowsAbout": ["תאונת קורקינט", "אופניים חשמליים", "פיצויים", "חוק פלת״ד"]
      },
      'machshevon': {
        "description": "מחשבון פיצויים תאונת דרכים — חישוב כאב וסבל, נכות והפסד שכר לפי חוק הפלת״ד.",
        "serviceType": "מחשבון פיצויים תאונות דרכים",
        "knowsAbout": ["מחשבון פיצויים", "כאב וסבל", "נכות", "הפסד שכר", "חוק פלת״ד"]
      },
      'nechut': {
        "description": "מחשבון נכות תאונת דרכים — כל אחוז נכות שווה עשרות אלפי שקלים. חשב כמה מגיע לך.",
        "serviceType": "חישוב פיצוי לפי אחוזי נכות",
        "knowsAbout": ["אחוזי נכות", "פיצויים", "מחשבון נכות", "חוק פלת״ד"]
      },
      'avoda': {
        "description": "עורך דין תאונות עבודה — פיצוי ממספר מקורות: ביטוח לאומי וחוק הפלת״ד.",
        "serviceType": "תביעות פיצויים תאונת עבודה",
        "knowsAbout": ["תאונת עבודה", "ביטוח לאומי", "פיצויים", "חוק פלת״ד"]
      },
      'holeh-regel': {
        "description": "עורך דין הולך רגל שנפגע בתאונה — זכאי לפיצוי מלא גם ללא אשם.",
        "serviceType": "תביעות פיצויים הולך רגל",
        "knowsAbout": ["הולך רגל", "תאונת דרכים", "פיצויים", "חוק פלת״ד"]
      },
      'shever': {
        "description": "פיצוי על שבר בתאונה — שבר ביד, ברגל או בברך מזכה בפיצוי על כאב, היעדרות ונזק עתידי.",
        "serviceType": "תביעות פיצויים שבר בתאונה",
        "knowsAbout": ["שבר בתאונה", "פיצויים", "כאב וסבל", "נכות"]
      },
      'pritzat-disc': {
        "description": "פיצוי על פריצת דיסק בתאונה — כאבי גב וצוואר אחרי תאונה מוכרים כנזק גוף.",
        "serviceType": "תביעות פיצויים פריצת דיסק",
        "knowsAbout": ["פריצת דיסק", "כאבי גב", "נזק גוף", "פיצויים", "נכות"]
      },
      'tzlipat-shot': {
        "description": "פיצוי על צליפת שוט — פגיעה בצוואר מוכרת בחוק גם ללא שבר וגם כשהתאונה נראתה קלה.",
        "serviceType": "תביעות פיצויים צליפת שוט",
        "knowsAbout": ["צליפת שוט", "פגיעה בצוואר", "פיצויים", "נכות"]
      },
      'ptsd': {
        "description": "פיצוי על נזק נפשי אחרי תאונה — PTSD, חרדה ופחד נהיגה מוכרים כראשי נזק בחוק הפלת״ד.",
        "serviceType": "תביעות פיצויים נזק נפשי PTSD",
        "knowsAbout": ["PTSD", "נזק נפשי", "חרדה", "פיצויים", "חוק פלת״ד"]
      }
    };

    const pageData = pageSchemas[pageSlug] || {};
    const schema = { ...baseSchema, ...pageData };

    const faqSchemas = {
      'taonat-drakhim': [
        { q: "כמה זמן לוקח לקבל פיצוי על תאונת דרכים?", a: "בממוצע 6-18 חודשים, תלוי במורכבות התיק ובשיתוף פעולה של חברת הביטוח." },
        { q: "כמה עולה ייצוג בתביעת תאונת דרכים?", a: "₪0 מראש. שכר הטרחה הוא 8%-13% מהפיצוי ומשולם רק מתוך הפיצוי שתקבל." },
      ],
      'ofanoa': [
        { q: "כמה פיצוי מקבלים על תאונת אופנוע?", a: "תאונות אופנוע גוררות פיצויים גבוהים יחסית בשל חומרת הפגיעות. הסכום תלוי באחוזי הנכות, הגיל והשכר." },
        { q: "אני אשם חלקית בתאונת האופנוע — מגיע לי פיצוי?", a: "כן. לפי חוק הפלת״ד, אשם תורם אינו שולל פיצוי. גם אם אשמת חלקית, מגיע לך פיצוי מלא." },
      ],
      'korkinet': [
        { q: "האם קורקינט חשמלי מכוסה בחוק הפיצויים?", a: "כן. מאז תיקון 9 לחוק הפלת״ד, קורקינטים ואופניים חשמליים מוגדרים ככלי רכב ומכוסים בחוק." },
        { q: "נפגעתי מקורקינט — מגיע לי פיצוי?", a: "כן. בין אם נפלת מקורקינט או נפגעת על ידי קורקינט, אתה זכאי לבדיקת זכאות לפיצוי." },
      ],
      'machshevon': [
        { q: "איך מחשבים פיצויים על תאונת דרכים?", a: "הפיצוי מחושב לפי 4 ראשי נזק: כאב וסבל, הפסד שכר, אובדן כושר השתכרות והוצאות רפואיות." },
        { q: "האם המחשבון מדויק?", a: "המחשבון נותן הערכה ראשונית לפי נוסחת הפלת״ד. הסכום הסופי נקבע לפי נסיבות התיק הספציפי." },
      ],
      'nechut': [
        { q: "כמה שווה כל אחוז נכות?", a: "הערך משתנה לפי גיל ושכר. באופן כללי, כל אחוז נכות שווה עשרות אלפי שקלים בפיצוי." },
        { q: "לא נקבעו לי אחוזי נכות — מגיע לי פיצוי?", a: "כן. גם ללא קביעת נכות רשמית, ייתכן שמגיע לך פיצוי על כאב וסבל, הפסד שכר והוצאות רפואיות." },
      ],
      'avoda': [
        { q: "נפגעתי בדרך לעבודה — ממה מגיע לי פיצוי?", a: "תאונה בדרך לעבודה מזכה בפיצוי ממספר מקורות: ביטוח לאומי (כתאונת עבודה) וגם תביעה לפי חוק הפלת״ד." },
        { q: "האם אני יכול לתבוע גם את המעסיק?", a: "בדרך כלל לא ישירות, אבל אם הייתה רשלנות מצד המעסיק, ייתכן שיש עילת תביעה נוספת." },
      ],
      'holeh-regel': [
        { q: "כהולך רגל שנפגע, האם צריך להוכיח שלא אשם?", a: "לא. לפי חוק הפלת״ד, הולך רגל זכאי לפיצוי מלא גם ללא הוכחת אשם מצד הרכב." },
        { q: "נפגעתי על מעבר חציה — כמה מגיע לי?", a: "הסכום תלוי בחומרת הפגיעה, אחוזי הנכות, הגיל והשכר. הזן את הנתונים למחשבון לקבלת הערכה." },
      ],
      'shever': [
        { q: "כמה פיצוי מקבלים על שבר בתאונה?", a: "הסכום תלוי בסוג השבר ובנכות שנותרה. שבר פשוט: נכות 0-5%. שבר עם מגבלה: 5-15%." },
        { q: "שבר שהתרפא לחלוטין — מגיע לי פיצוי?", a: "כן. גם שבר שהתרפא מזכה בפיצוי על כאב וסבל, ימי אשפוז והיעדרות מעבודה." },
      ],
      'pritzat-disc': [
        { q: "פריצת דיסק אחרי תאונה — מגיע לי פיצוי?", a: "כן. פריצת דיסק מוכרת כנזק גוף בחוק ומזכה בפיצוי משמעותי, בדרך כלל נכות של 10-25%." },
        { q: "איך מוכיחים שפריצת הדיסק קשורה לתאונה?", a: "באמצעות בדיקות MRI וחוות דעת רפואית. גם אם הייתה בעיה קודמת, החמרה בעקבות תאונה מזכה בפיצוי." },
      ],
      'tzlipat-shot': [
        { q: "צליפת שוט ללא שבר — מגיע לי פיצוי?", a: "כן. צליפת שוט מוכרת כנזק גוף בחוק גם ללא שבר. כאבי צוואר וגב מזכים בפיצוי." },
        { q: "התאונה נראתה קלה אבל יש לי כאבים — מה עושים?", a: "פנו מיד לרופא ותעדו את הכאבים. גם תאונה קלה יכולה לגרום לצליפת שוט שמזכה בפיצוי." },
      ],
      'ptsd': [
        { q: "נזק נפשי אחרי תאונה — מגיע לי פיצוי?", a: "כן. PTSD, חרדה ופחד נהיגה מוכרים כראשי נזק בחוק הפלת״ד ומזכים בפיצוי." },
        { q: "איך מוכיחים PTSD אחרי תאונה?", a: "באמצעות אבחון פסיכיאטרי או פסיכולוגי. תיעוד מוקדם של תסמינים מחזק את התביעה." },
      ],
    };

    const defaultFaq = [
      { q: "כמה עולה ייצוג משפטי?", a: "שכר טרחה על בסיס הצלחה בלבד — 8%-13% מהפיצוי. אין תשלום מראש." },
      { q: "כמה זמן לוקח לקבל פיצוי?", a: "בממוצע 6-18 חודשים, תלוי במורכבות התיק." },
      { q: "האם מגיע לי פיצוי גם בתאונה קלה?", a: "כן. גם ללא שברים מגיע פיצוי על כאב וסבל." }
    ];

    const faqItems = faqSchemas[pageSlug] || defaultFaq;
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
        {
          "@type": "ListItem",
          "position": 1,
          "name": "דף הבית",
          "item": "https://nifgati.co.il"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": pageTitle,
          "item": `https://nifgati.co.il/${pageSlug}`
        }
      ]
    };

    const schemaId = `nifgati-lp-schema-${pageSlug}`;
    const faqId = `nifgati-lp-faq-${pageSlug}`;
    const breadcrumbId = `nifgati-lp-breadcrumb-${pageSlug}`;
    if (!document.getElementById(schemaId)) {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = schemaId;
      el.textContent = JSON.stringify(schema);
      document.head.appendChild(el);
    }
    if (!document.getElementById(faqId)) {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = faqId;
      el.textContent = JSON.stringify(faqSchema);
      document.head.appendChild(el);
    }
    if (!document.getElementById(breadcrumbId)) {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = breadcrumbId;
      el.textContent = JSON.stringify(breadcrumbSchema);
      document.head.appendChild(el);
    }

    return () => {
      document.getElementById(schemaId)?.remove();
      document.getElementById(faqId)?.remove();
      document.getElementById(breadcrumbId)?.remove();
    };
  }, [pageSlug]);

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

  const G = "#c9a84c";
  const oBtn = { background:"transparent", color:G, border:`1.5px solid ${G}88`, borderRadius:12, fontFamily:"inherit", fontWeight:700, fontSize:14, padding:"12px 24px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 };

  const openingMessage = getPersonalizedOpening(pageSlug, utmTerm);

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
      <header role="banner" style={{ position:"fixed", top:showBanner ? 40 : 0, right:0, left:0, zIndex:100, background:scrolled ? "#080d18f0" : "transparent", backdropFilter:scrolled ? "blur(12px)" : "none", borderBottom:scrolled ? "1px solid #1e2d4a" : "1px solid transparent", transition:"all .3s", padding: isMobile ? "0 8px" : "0 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", height: isMobile ? 52 : 64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" aria-label="nifgati — עמוד בית" style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/logo.png" alt="nifgati" width={isMobile ? 112 : 225} height={isMobile ? 28 : 56} style={{ height: isMobile ? 28 : 56, width:"auto", objectFit:"contain" }} />
          </a>
          <a href="tel:0544338212" aria-label="התקשר אלינו" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, background:"#22c55e", borderRadius: isMobile ? 10 : 14, color:"#fff", fontSize: isMobile ? 17 : 22, textDecoration:"none", flexShrink:0, boxShadow:"0 2px 8px #22c55e55" }}>📞</a>
        </div>
      </header>

      {/* MAIN */}
      <main id="main-content" role="main" style={{ flex:1 }}>

        {/* HERO */}
        <section aria-label={dynamicTitle} style={{ display:"flex", alignItems:"center", position:"relative", overflow:"hidden", paddingTop:showBanner ? 120 : 80 }}>
          <div style={{ position:"absolute", top:"20%", right:"-8%", width:500, height:500, background:"radial-gradient(circle, #c9a84c09 0%, transparent 70%)", pointerEvents:"none" }} aria-hidden="true" />
          <div className="hero-wrap" style={{ maxWidth:900, margin:"0 auto", padding:"48px 24px 32px", width:"100%", textAlign:"center" }}>

              <h1 className="ht" style={{ fontSize:44, fontWeight:900, lineHeight:1.25, marginBottom:14 }}>
                {dynamicTitle}
              </h1>
              <h2 className="hero-sub" style={{ fontSize:18, fontWeight:700, color:"#7a8fa5", marginBottom:24, lineHeight:1.6 }}>{pageSubtitle}</h2>

              <div className="hero-bullets" style={{ display:"inline-flex", flexDirection:"column", gap:12, marginBottom:32, textAlign:"right" }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:15, color:"#bcc8d4", lineHeight:1.6 }}>
                    <span style={{ color:G, fontWeight:700, flexShrink:0, fontSize:16, marginTop:2 }}>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {socialProofAmount && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:12, background:"#141b2d", border:"1px solid #1e2d4a", borderRadius:14, padding:"12px 20px", marginBottom:24 }}>
                  <span style={{ fontSize:24, fontWeight:900, color:G }}>{socialProofAmount}</span>
                  <span style={{ fontSize:13, color:"#7a8fa5" }}>{socialProofLabel}</span>
                </div>
              )}
          </div>
        </section>

        {/* ── INLINE BOT ── */}
        <section id="inline-bot" style={{ padding:"0 16px 2rem" }}>
          <div style={{ width:"100%", maxWidth:680, margin:"0 auto" }}>
            <Bot inline={true} openingMessage={openingMessage} />
          </div>

          {/* Trust bullets */}
          <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", marginTop:24 }}>
            {[
              { icon:"✓", text:"חינמי לחלוטין" },
              { icon:"✓", text:"אנונימי — השיחה לא נשמרת" },
              { icon:"✓", text:`25 שנות ניסיון — ${MY_NAME}, עו״ד נזיקין` },
            ].map((b, i) => (
              <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:"#7a8fa5" }}>
                <span style={{ color:G, fontWeight:700 }}>{b.icon}</span>
                {b.text}
              </span>
            ))}
          </div>
        </section>

        {/* CTA SECTION */}
        <section style={{ padding:"68px 24px", background:"#0d1323" }}>
          <div className="sect-inner" style={{ maxWidth:500, margin:"0 auto", textAlign:"center" }}>
            <h2 style={{ fontSize:28, fontWeight:900, marginBottom:12 }}>דברו איתנו עכשיו</h2>
            <p style={{ color:"#7a8fa5", fontSize:15, marginBottom:36 }}>ייעוץ ראשוני חינמי, ללא התחייבות</p>
            <a href={`tel:${PHONE}`}>
              <button style={{ ...oBtn, width:"100%", justifyContent:"center", fontSize:16, padding:16 }} aria-label={`התקשר: ${PHONE}`}>📞 {PHONE} — התקשר עכשיו</button>
            </a>
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

      {/* WhatsApp float */}
      <button className="wa-btn" onClick={() => openWhatsApp(window.location.pathname)} aria-label="פתח שיחת וואטסאפ">💬</button>

      {/* Cookie Banner */}
      {!cookie && (
        <div style={{ position:"fixed", bottom:0, right:0, left:0, background:"#0a0f1eee", borderTop:"1px solid #1e2d4a22", padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, zIndex:98, fontSize:11, color:"#445566" }}>
          <span>האתר משתמש בעוגיות Remarketing בלבד. שיחות הבוט אינן נשמרות. <a href="/privacy" style={{ color:"#c9a84c88" }}>פרטיות</a></span>
          <button style={{ background:"#c9a84c22", color:"#c9a84c", border:"1px solid #c9a84c44", borderRadius:8, fontFamily:"inherit", fontSize:11, padding:"4px 10px", cursor:"pointer", flexShrink:0 }} onClick={() => setCookie(true)}>אישור ✓</button>
        </div>
      )}
    </div>
  );
}
