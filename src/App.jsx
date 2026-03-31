import { useState, useEffect, useRef } from "react";
// v2 — mic permission fix + file upload: images & documents only
// ╔══════════════════════════════════════╗
// ║  שנה כאן את הפרטים שלך             ║
const PHONE    = "0544338212";
const WA       = "972544338212";
const MY_NAME  = "דן אלון";
const MY_TITLE = "עורך דין נזיקין";
// ╚══════════════════════════════════════╝

// helpers
function parseCalc(t) {
  if (!t.includes("---חישוב---")) return null;
  const mn = t.match(/סה"כ מינימום:\s*₪([\d,]+)/);
  const mx = t.match(/סה"כ מקסימום:\s*₪([\d,]+)/);
  if (!mn || !mx) return null;
  return { min: parseInt(mn[1].replace(/,/g,"")), max: parseInt(mx[1].replace(/,/g,"")) };
}

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

async function callClaude(messages, model = "claude-haiku-4-5-20251001") {
  const trimmed = messages.slice(-12);
  const r = await fetch("/api/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ messages: trimmed, model }),
  });
  if(!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error||"שגיאה"); }
  const d = await r.json();
  return d.content?.[0]?.text || "";
}

// ── Bot overlay ─────────────────────────────────────────
function Bot({ onClose }) {
  const [msgs, setMsgs] = useState([{ role:"assistant", content:"שלום 👋\n\nספר/י לי — מה קרה בתאונה וממה אתה סובל/ת?\n\n🎙️ דבר/י, כתוב/י, או 📎 צרף/י מסמך רפואי לניתוח אוטומטי." }]);
  const [inp, setInp]   = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(null);
  const [mic, setMic]   = useState(false);
  const [err, setErr]   = useState("");
  const [docName, setDocName] = useState("");
  const fileRef = useRef(null);
  const end = useRef(null);
  useEffect(()=>{ end.current?.scrollIntoView({behavior:"smooth"}); },[msgs,load]);

  async function send(txt) {
    if(!txt.trim()||load) return;
    setErr(""); setInp("");
    const next = [...msgs, {role:"user",content:txt}];
    setMsgs(next); setLoad(true);
    try {
      const rep = await callClaude(next.map(m=>({role:m.role,content:m.content})));
      setMsgs(p=>[...p,{role:"assistant",content:rep}]);
      const c = parseCalc(rep); if(c) setCalc(c);
    } catch(e) { setErr(e.message||"שגיאת חיבור"); }
    setLoad(false);
  }

  async function sendDoc(file) {
    if(load) return;
    if (file.size > 10 * 1024 * 1024) {
      setErr("הקובץ גדול מדי — עד 10MB בלבד.");
      return;
    }
    setErr(""); setLoad(true);
    setDocName(file.name);

    try {
      // המר לBase64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.onerror = () => rej(new Error("שגיאה בקריאת הקובץ"));
        reader.readAsDataURL(file);
      });

      const isImage = file.type.startsWith("image/");
      const isPDF   = file.type === "application/pdf";
      const isDoc   = ["application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain"].includes(file.type);

      if (!isImage && !isPDF && !isDoc) {
        setErr("ניתן לצרף PDF, תמונה, Word, Excel או טקסט.");
        setLoad(false); setDocName("");
        return;
      }

      // הודעת משתמש עם המסמך
      const userContent = [
        isImage
          ? { type:"image", source:{ type:"base64", media_type:file.type, data:base64 } }
          : { type:"document", source:{ type:"base64", media_type: file.type, data:base64 } },
        { type:"text", text:`צירפתי מסמך רפואי (${file.name}). אנא נתח אותו ומצא: אחוזי נכות, אבחנות רפואיות, תאריך פגיעה, וכל מידע רלוונטי לחישוב פיצויים.` }
      ];

      const userMsg = { role:"user", content: userContent };
      const displayMsg = { role:"user", content:`📎 צורף מסמך: ${file.name}` };
      const next = [...msgs, displayMsg];
      setMsgs(next);

      // שלח ל-Sonnet (קורא מסמכים)
      const apiMsgs = [...msgs.map(m=>({role:m.role,content:m.content})), userMsg];
      const rep = await callClaude(apiMsgs, "claude-sonnet-4-20250514");
      setMsgs(p=>[...p,{role:"assistant",content:rep}]);
      const c = parseCalc(rep); if(c) setCalc(c);

    } catch(e) {
      setErr(e.message||"שגיאה בניתוח המסמך");
    }
    setLoad(false); setDocName("");
  }

  async function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("זיהוי קול לא נתמך בדפדפן זה — כתוב/י ידנית."); return; }
    if (mic) return;

    // בקש הרשאת מיקרופון מפורשת לפני הפעלת זיהוי דיבור
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (permErr) {
      const mob = /Android|iPhone|iPad/i.test(navigator.userAgent);
      setErr(mob
        ? "יש לאשר גישה למיקרופון: הגדרות הדפדפן ← הגדרות אתר ← מיקרופון ← nifgati.co.il ← אפשר"
        : "לחץ 🔒 בשורת הכתובת ← מיקרופון ← אפשר ← רענן דף"
      );
      return;
    }

    const r = new SR();
    r.lang = "he-IL";
    r.continuous = false;
    r.interimResults = false;

    r.onstart  = () => { setMic(true); setErr(""); };
    r.onresult = e  => { setInp(e.results[0][0].transcript); setMic(false); };
    r.onend    = ()  => setMic(false);
    r.onerror  = e  => {
      setMic(false);
      if (e.error === "no-speech") { setErr("לא זוהה דיבור — נסה שוב."); return; }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        const mob = /Android|iPhone|iPad/i.test(navigator.userAgent);
        setErr(mob
          ? "יש לאשר גישה למיקרופון: הגדרות הדפדפן ← הגדרות אתר ← מיקרופון ← nifgati.co.il ← אפשר"
          : "לחץ 🔒 בשורת הכתובת ← מיקרופון ← אפשר ← רענן דף"
        );
        return;
      }
      if (e.error === "aborted") return;
      if (e.error === "network") { setErr("שגיאת רשת — בדוק חיבור אינטרנט ונסה שוב."); return; }
      setErr("זיהוי קול לא זמין כרגע — כתוב/י ידנית.");
    };

    try { r.start(); } catch(e) { setMic(false); setErr("זיהוי קול לא זמין כרגע — נסה לרענן את הדף."); }
  }

  const waMsg = calc
    ? `שלום, השתמשתי במחשבון הפיצויים. הסכום המשוער: ₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}. אשמח לייעוץ.`
    : "שלום, פניתי דרך האתר. אשמח לייעוץ בנושא תאונת דרכים.";

  return (
    <div role="dialog" aria-modal="true" aria-label="בוט פיצויים" style={{ position:"fixed",inset:0,background:"#080d18ee",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#0a0f1e",border:"1px solid #1e2d4a",borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ background:"#070c18",borderBottom:"1px solid #1e2d4a",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontWeight:900,fontSize:15,color:"#c9a84c" }}>🤖 בוט הפיצויים</div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <span style={{ fontSize:12,color:"#445566",display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:6,height:6,background:"#22c55e",borderRadius:"50%",display:"inline-block" }}/>
              השיחה לא נשמרת ולא מתועדת
            </span>
            <button onClick={onClose} aria-label="סגור בוט" style={{ background:"transparent",border:"none",color:"#7a8fa5",fontSize:20,cursor:"pointer",lineHeight:1 }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12 }}>
          {msgs.map((m,i)=>(
            <div key={i} style={{ display:"flex",justifyContent:m.role==="user"?"flex-start":"flex-end" }}>
              <div style={{ background:m.role==="user"?"#c9a84c":"#141b2d",color:m.role==="user"?"#0a0f1e":"#e8eaf0",border:m.role==="user"?"none":"1px solid #1e2d4a",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",maxWidth:"85%",fontSize:14,lineHeight:1.75,fontWeight:m.role==="user"?600:400,whiteSpace:"pre-wrap" }}>{m.content}</div>
            </div>
          ))}
          {load && <div style={{ display:"flex",justifyContent:"flex-end" }}><div style={{ background:"#141b2d",border:"1px solid #1e2d4a",borderRadius:"18px 18px 18px 4px",padding:"14px 18px",display:"flex",gap:4 }}>{[0,.2,.4].map(d=><span key={d} style={{ display:"inline-block",width:7,height:7,background:"#c9a84c",borderRadius:"50%",animation:"bl 1.2s infinite",animationDelay:`${d}s` }}/>)}</div></div>}
          {calc && !load && (
            <div style={{ background:"linear-gradient(135deg,#1a2744,#0f1a30)",border:"1px solid #c9a84c55",borderRadius:16,padding:"18px 20px" }}>
              <div style={{ fontSize:11,color:"#c9a84c",letterSpacing:1,marginBottom:6,fontWeight:700 }}>הערכת פיצוי ראשונית</div>
              <div style={{ fontSize:28,fontWeight:900,color:"#fff",marginBottom:4 }}>₪{calc.min.toLocaleString("he-IL")} – ₪{calc.max.toLocaleString("he-IL")}</div>
              <div style={{ fontSize:12,color:"#556070",marginBottom:14 }}>לפני שכ"ט (8%–13%)</div>
              <button onClick={()=>window.open(`https://wa.me/${WA}?text=${encodeURIComponent(waMsg)}`,"_blank")} aria-label="שלח לוואטסאפ לייעוץ" style={{ width:"100%",background:"#25d366",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:15,padding:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>📱 שלח לוואטסאפ לייעוץ חינמי</button>
            </div>
          )}
          {err && <div role="alert" style={{ textAlign:"center",fontSize:13,color:"#ef4444" }}>{err}</div>}
          <div ref={end}/>
        </div>

        <div style={{ background:"#0a0f1e",borderTop:"1px solid #1e2d4a",padding:"12px 16px 14px" }}>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={startMic} aria-label={mic?"מקליד...":"הקלט קול בעברית"} style={{ background:mic?"#c9a84c22":"#141b2d",border:`1px solid ${mic?"#c9a84c":"#1e2d4a"}`,borderRadius:12,color:"#c9a84c",fontSize:20,width:48,height:48,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{mic?"🔴":"🎙️"}</button>
            <button onClick={()=>fileRef.current?.click()} disabled={load} aria-label="צרף מסמך רפואי" title="צרף PDF או תמונה" style={{ background:"#141b2d",border:"1px solid #1e2d4a",borderRadius:12,color:"#7a8fa5",fontSize:20,width:48,height:48,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:load?.35:1 }}>📎</button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) sendDoc(f); e.target.value=""; }}/>
            <input aria-label="הקלד הודעה" style={{ flex:1,background:"#141b2d",border:"1px solid #1e2d4a",borderRadius:12,color:"#fff",fontFamily:"inherit",fontSize:14,padding:"0 14px",outline:"none",height:48,direction:"rtl" }} placeholder="כתוב, דבר, או צרף מסמך רפואי..." value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();send(inp);} }}/>
            <button onClick={()=>send(inp)} disabled={load||!inp.trim()} aria-label="שלח הודעה" style={{ background:"#c9a84c",color:"#0a0f1e",border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:14,padding:"0 20px",cursor:"pointer",height:48,opacity:(load||!inp.trim())?.35:1 }}>שלח</button>
          </div>
          {docName && <p style={{ textAlign:"center",fontSize:12,color:"#c9a84c",marginTop:6 }}>🔍 מנתח: {docName}...</p>}
          <p style={{ textAlign:"center",fontSize:11,color:"#2a3545",marginTop:8 }}>הערכה ראשונית בלבד • אינה מהווה ייעוץ משפטי • המידע אינו נשמר ואינו מתועד בשום אופן</p>
        </div>
      </div>
      <style>{`@keyframes bl{0%,80%,100%{opacity:.15}40%{opacity:1}}`}</style>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────
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

      {/* SKIP NAV — נגישות */}
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
