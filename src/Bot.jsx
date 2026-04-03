import { useState, useEffect, useRef } from "react";

const WA       = "972544338212";
const MY_NAME  = "דן אלון";

function parseCalc(t) {
  if (!t.includes("---חישוב---")) return null;
  const mn = t.match(/סה"כ מינימום:\s*₪([\d,]+)/);
  const mx = t.match(/סה"כ מקסימום:\s*₪([\d,]+)/);
  if (!mn || !mx) return null;
  return { min: parseInt(mn[1].replace(/,/g,"")), max: parseInt(mx[1].replace(/,/g,"")) };
}

// Extract phone number from conversation messages
function extractPhone(msgs) {
  // Search last 5 user messages for a phone number
  const userMsgs = msgs.filter(m => m.role === "user" && typeof m.content === "string").slice(-5);
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const match = userMsgs[i].content.match(/0[2-9]\d[\d-]{6,9}/);
    if (match) return match[0].replace(/-/g, "");
  }
  return "";
}

// Send lead notification email in background — never blocks UI
function notifyLead(msgs, calc) {
  try {
    const summary = "lead";
    const phone = extractPhone(msgs);
    const userMsgs = msgs.filter(m => m.role === "user" && typeof m.content === "string");
    const injury = userMsgs.length > 0 ? userMsgs[0].content.slice(0, 120) : "";
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, calculation: calc, phone, injury }),
    }).catch(() => {}); // Silent — never affects user experience
  } catch (_) {}
}

async function callClaude(messages, model = "claude-haiku-4-5-20251001") {
  // Clean messages: strip custom flags, keep only role+content
  const cleaned = messages.slice(-12).map(m => {
    const msg = { role: m.role, content: m.content };
    // Strip base64 from OLD messages to avoid ballooning the request body.
    // Only the LAST message (the new one) keeps its base64 content.
    return msg;
  });
  const r = await fetch("/api/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ messages: cleaned, model }),
  });
  if(!r.ok) { const e=await r.json().catch(()=>({})); console.error("API error:", r.status, e); throw new Error(e.error||"שגיאה"); }
  const d = await r.json();
  const text = d.content?.[0]?.text;
  if (!text) throw new Error("תשובה ריקה — נסה שוב.");
  return text;
}

const GREETING_1 = { role:"assistant", content:`שלום 👋

נפגעת בתאונה? בוא נבדוק ב-60 שניות כמה פיצוי מגיע לך.

🎙️ דבר/י, כתוב/י, או 📎 צרף/י מסמך רפואי.`, privacy: true };

const GREETING_2 = { role:"assistant", content:"ספר/י לי בקצרה: מה קרה, בן כמה את/ה, כמה את/ה משתכר/ת ואיפה נפגעת בגוף?" };

const INITIAL_MSGS = [GREETING_1, GREETING_2];

const CTA_MSG = `ניתן לעבור בכל שלב להתייעצות עם עורך דין ${MY_NAME} לתכנון הצעדים הבאים ומיקסום הפיצוי.`;

export default function Bot({ onClose }) {
  const [msgs, setMsgs] = useState([...INITIAL_MSGS]);
  const [inp, setInp]   = useState("");
  const [load, setLoad] = useState(false);
  const [calc, setCalc] = useState(null);
  const [mic, setMic]   = useState(false);
  const [err, setErr]   = useState("");
  const [docName, setDocName] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [ctaShown, setCtaShown] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const fileRef = useRef(null);
  const camRef  = useRef(null);
  const inpRef  = useRef(null);
  const end = useRef(null);
  const micRef = useRef(null);
  useEffect(()=>{ end.current?.scrollIntoView({behavior:"smooth"}); },[msgs,load]);

  useEffect(()=>{ if(!err) return; const t=setTimeout(()=>setErr(""),6000); return ()=>clearTimeout(t); },[err]);

  function restart() { setMsgs([...INITIAL_MSGS]); setCalc(null); setInp(""); setErr(""); setDocName(""); setCtaShown(false); setShowReferral(false); }

  const REFERRAL_RE = /עורך.?דין|עו"ד|דן אלון|לדבר עם|להעביר|תעביר|אנושי|בן.?אדם|lawyer/i;

  async function send(txt) {
    if(!txt.trim()||load) return;
    setErr(""); setInp("");
    // Detect referral request
    if (REFERRAL_RE.test(txt)) {
      setMsgs(p=>[...p,{role:"user",content:txt},{role:"assistant",content:`בשמחה! עו"ד ${MY_NAME} ישמח לעזור. לחץ על הכפתור למטה לשליחת הפרטים בוואטסאפ.`}]);
      setShowReferral(true);
      return;
    }
    const next = [...msgs, {role:"user",content:txt}];
    setMsgs(next); setLoad(true);
    try {
      const rep = await callClaude(next.map(m=>({role:m.role,content:typeof m.content==="string"?m.content:"[הודעה]"})));
      const updated = [...next, {role:"assistant",content:rep}];
      const userCount = next.filter(m=>m.role==="user").length;
      // Show CTA after first exchange or after 3+ messages without calc
      if (!ctaShown && (userCount === 1 || userCount >= 3)) {
        updated.push({role:"assistant",content:CTA_MSG});
        setCtaShown(true);
      }
      setMsgs(updated);
      // Send email after first user message + on every calculation
      if (userCount === 1) notifyLead(updated, null);
      const c = parseCalc(rep);
      if (c) { setCalc(c); setShowReferral(true); notifyLead(updated, c); window.dataLayer = window.dataLayer || []; window.dataLayer.push({event: 'calculation_complete', value_min: c.min, value_max: c.max}); }
    } catch(e) { setErr(e.message||"שגיאת חיבור"); }
    setLoad(false);
  }

  // Compress image to fit Vercel's 4.5MB body limit
  async function compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Convert to JPEG for smaller size
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
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
      const isImage = file.type.startsWith("image/");
      const isPDF   = file.type === "application/pdf";
      const isDoc   = ["application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain"].includes(file.type);

      if (!isImage && !isPDF && !isDoc) {
        setErr("ניתן לצרף PDF, תמונה, Word, Excel או טקסט.");
        setLoad(false); setDocName("");
        return;
      }

      let base64, mediaType;

      if (isImage) {
        // Try to compress images to avoid Vercel 4.5MB body limit
        const compressed = await compressImage(file);
        if (compressed) {
          base64 = compressed.base64;
          mediaType = compressed.mediaType;
        } else {
          // Fallback: send raw if compression fails (e.g., HEIC on some browsers)
          base64 = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result.split(",")[1]);
            reader.onerror = () => rej(new Error("שגיאה בקריאת הקובץ"));
            reader.readAsDataURL(file);
          });
          mediaType = file.type;
        }
      } else {
        // PDFs and docs — read as-is
        base64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(",")[1]);
          reader.onerror = () => rej(new Error("שגיאה בקריאת הקובץ"));
          reader.readAsDataURL(file);
        });
        mediaType = file.type;
      }

      // Check final base64 size (Vercel limit ~4.5MB body)
      if (base64.length > 3_500_000) {
        setErr("הקובץ גדול מדי לעיבוד — נסה לצלם מחדש באיכות נמוכה יותר.");
        setLoad(false); setDocName("");
        return;
      }

      const userContent = [
        isImage
          ? { type:"image", source:{ type:"base64", media_type: mediaType, data:base64 } }
          : { type:"document", source:{ type:"base64", media_type: mediaType, data:base64 } },
        { type:"text", text:`צירפתי מסמך רפואי (${file.name}). אנא נתח אותו ומצא: אחוזי נכות, אבחנות רפואיות, תאריך פגיעה, וכל מידע רלוונטי לחישוב פיצויים.` }
      ];

      const userMsg = { role:"user", content: userContent };
      const displayMsg = { role:"user", content:`📎 צורף מסמך: ${file.name}` };
      const next = [...msgs, displayMsg];
      setMsgs(next);

      // Strip base64 from old messages — only send text history + the new document
      const historyMsgs = msgs.map(m => {
        // Convert multi-part (old uploads) to text-only summaries
        if (Array.isArray(m.content)) {
          const textParts = m.content.filter(p => p.type === "text").map(p => p.text).join(" ");
          return { role: m.role, content: textParts || "[מסמך שנותח]" };
        }
        return { role: m.role, content: typeof m.content === "string" ? m.content : "[הודעה]" };
      });
      const apiMsgs = [...historyMsgs, userMsg];
      const rep = await callClaude(apiMsgs, "claude-sonnet-4-20250514");
      setMsgs(p=>[...p,{role:"assistant",content:rep}]);
      const c = parseCalc(rep);
      if (c) { setCalc(c); setShowReferral(true); notifyLead([...historyMsgs,{role:"assistant",content:rep}], c); window.dataLayer = window.dataLayer || []; window.dataLayer.push({event: 'calculation_complete', value_min: c.min, value_max: c.max}); }
      // Always show CTA after document analysis
      if (!ctaShown) { setMsgs(p=>[...p,{role:"assistant",content:CTA_MSG}]); setCtaShown(true); }

    } catch(e) {
      setErr(e.message||"שגיאה בניתוח המסמך");
    }
    setLoad(false); setDocName("");
  }

  function toggleMic() {
    if (mic) {
      // Stop
      if (micRef.current) { try { micRef.current.stop(); } catch(e){} }
      setMic(false);
      return;
    }
    startMic();
  }

  async function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("זיהוי קול לא נתמך בדפדפן זה — כתוב/י ידנית."); return; }

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
    micRef.current = r;
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

  const userMsgs = msgs.filter(m=>m.role==="user").map(m=>typeof m.content==="string"?m.content:"").filter(Boolean);
  const allText = userMsgs.join(" ");
  // Extract structured data from conversation
  const ageMatch = allText.match(/בן\s*(\d+)|בת\s*(\d+)|(\d+)\s*שנ/);
  const age = ageMatch ? (ageMatch[1]||ageMatch[2]||ageMatch[3]) : "";
  const salaryMatch = allText.match(/([\d,]+)\s*(?:₪|שקל|ש"ח|שכר|ברוטו)/);
  const salary = salaryMatch ? salaryMatch[1] : "";
  const isWork = /עבודה|בדרך ל/.test(allText);
  const injuryWords = userMsgs[0] ? userMsgs[0].slice(0,100) : "";

  const waMsg = calc
    ? `היי אלון, קיבלתי הערכה מהבוט עבור ${injuryWords} בתאונה ${isWork?"בדרך לעבודה":"פרטית"}.${age?` אני בן ${age}.`:""}${salary?` משתכר ${salary} ₪.`:""}\nהערכת פיצוי: ₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}.\nאשמח לבדיקה שלך.`
    : userMsgs.length
      ? `היי דני, הגעתי מהבוט. תיאור: ${userMsgs.slice(0,3).join(" | ").slice(0,200)}. אשמח לפרטים.`
      : "היי דני, הגעתי מהבוט ואשמח לפרטים.";

  const btnSm = { background:"#141b2d",border:"1px solid #1e2d4a",borderRadius:10,color:"#7a8fa5",fontSize:16,width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 };

  return (
    <div role="dialog" aria-modal="true" aria-label="בוט פיצויים" style={{ position:"fixed",inset:0,background:"#080d18ee",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#0a0f1e",border:"1px solid #1e2d4a",borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative" }}>
        <div style={{ background:"#070c18",borderBottom:"1px solid #1e2d4a",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontWeight:900,fontSize:15,color:"#c9a84c" }}>🤖 בוט הפיצויים</div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <span style={{ fontSize:12,color:"#445566",display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:6,height:6,background:"#22c55e",borderRadius:"50%",display:"inline-block" }}/>
              השיחה לא נשמרת ולא מתועדת
            </span>
            <a href="tel:0544338212" aria-label="התקשר לעו״ד אלון" title="התקשר" style={{ background:"#25d366",border:"none",color:"#fff",fontSize:15,cursor:"pointer",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",boxShadow:"0 2px 8px #25d36644" }}>📞</a>
            <button onClick={onClose} aria-label="סגור בוט" style={{ background:"transparent",border:"none",color:"#7a8fa5",fontSize:20,cursor:"pointer",lineHeight:1 }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12 }}>
          {msgs.map((m,i)=>(
            <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-start":"flex-end" }}>
              <div style={{ background:m.role==="user"?"#c9a84c":"#141b2d",color:m.role==="user"?"#0a0f1e":"#e8eaf0",border:m.role==="user"?"none":"1px solid #1e2d4a",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",maxWidth:"85%",fontSize:14,lineHeight:1.75,fontWeight:m.role==="user"?600:400,whiteSpace:"pre-wrap" }}>{m.content}</div>
              {m.privacy && <div style={{ maxWidth:"85%",textAlign:"right",marginTop:4,fontSize:12 }}>🔒 הפרטיות שלך חשובה: המידע נמחק בסיום השיחה ואינו נשמר אצלנו. <a href="/privacy" target="_blank" rel="noopener" style={{ color:"#3b82f6",textDecoration:"underline" }}>מדיניות פרטיות</a></div>}
            </div>
          ))}
          {load && <div style={{ display:"flex",justifyContent:"flex-end" }}><div role="status" aria-label="הבוט מקליד..." style={{ background:"#141b2d",border:"1px solid #1e2d4a",borderRadius:"18px 18px 18px 4px",padding:"14px 18px",display:"flex",gap:4 }}><span style={{ position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0,0,0,0)" }}>הבוט מקליד...</span>{[0,.2,.4].map(d=><span key={d} aria-hidden="true" style={{ display:"inline-block",width:7,height:7,background:"#c9a84c",borderRadius:"50%",animation:"bl 1.2s infinite",animationDelay:`${d}s` }}/>)}</div></div>}
          {calc && !load && (
            <div style={{ background:"linear-gradient(135deg,#1a2744,#0f1a30)",border:"1px solid #c9a84c55",borderRadius:16,padding:"18px 20px" }}>
              <div style={{ fontSize:11,color:"#c9a84c",letterSpacing:1,marginBottom:6,fontWeight:700 }}>הערכת פיצוי ראשונית</div>
              <div style={{ fontSize:28,fontWeight:900,color:"#fff",marginBottom:4 }}>₪{calc.min.toLocaleString("he-IL")} – ₪{calc.max.toLocaleString("he-IL")}</div>
              <div style={{ fontSize:12,color:"#556070",marginBottom:14 }}>לפני שכ"ט (8%–13%)</div>
              <div style={{ textAlign:"center",fontSize:22,animation:"bounce 1s ease-in-out infinite",marginBottom:6 }}>👇</div>
              <button onClick={()=>window.location.href=`https://wa.me/${WA}?text=${encodeURIComponent(waMsg)}`} aria-label="שלח את החישוב לעורך דין בוואטסאפ" style={{ width:"100%",background:"#25d366",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:14,padding:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,lineHeight:1.4 }}>💬 שלח את החישוב לעו"ד בוואטסאפ</button>
            </div>
          )}
          {showReferral && !calc && (
            <div style={{ padding:"0 4px" }}>
              <button onClick={()=>window.location.href=`https://wa.me/${WA}?text=${encodeURIComponent(waMsg)}`} style={{ width:"100%",background:"#25d366",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:14,padding:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,lineHeight:1.4 }}>📱 שליחת הנתונים לעו"ד אלון ובדיקת זכאות בוואטסאפ</button>
            </div>
          )}
          {err && <div role="alert" style={{ textAlign:"center",fontSize:13,color:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}><span>{err}</span><button onClick={()=>setErr("")} aria-label="סגור הודעת שגיאה" style={{ background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16,lineHeight:1,flexShrink:0 }}>✕</button></div>}
          <div ref={end}/>
        </div>

        {/* Custom file picker modal — dark overlay */}
        {showFilePicker && (
          <div onClick={()=>setShowFilePicker(false)} style={{ position:"absolute",inset:0,background:"#080d18dd",zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:"#0d1323",border:"1px solid #1e2d4a",borderRadius:20,padding:24,width:"100%",maxWidth:320,display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                <span style={{ fontSize:16,fontWeight:800,color:"#e8eaf0" }}>📎 צירוף מסמך רפואי</span>
                <button onClick={()=>setShowFilePicker(false)} style={{ background:"transparent",border:"none",color:"#7a8fa5",fontSize:20,cursor:"pointer",lineHeight:1 }}>✕</button>
              </div>
              <p style={{ fontSize:12,color:"#556070",lineHeight:1.5,marginBottom:4 }}>PDF, תמונה, או מסמך Word — עד 10MB</p>
              <button onClick={()=>{ setShowFilePicker(false); setTimeout(()=>camRef.current?.click(),100); }} style={{ background:"#141b2d",border:"1.5px solid #1e2d4a",borderRadius:14,color:"#e8eaf0",fontFamily:"inherit",fontSize:15,fontWeight:700,padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s" }} onMouseOver={e=>{e.currentTarget.style.borderColor="#c9a84c";e.currentTarget.style.background="#1a2744"}} onMouseOut={e=>{e.currentTarget.style.borderColor="#1e2d4a";e.currentTarget.style.background="#141b2d"}}>
                <span style={{ fontSize:24,width:36,height:36,background:"#c9a84c18",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center" }}>📷</span>
                <div><div>צילום מסמך</div><div style={{ fontSize:11,color:"#7a8fa5",fontWeight:400 }}>פתח מצלמה וצלם</div></div>
              </button>
              <button onClick={()=>{ setShowFilePicker(false); setTimeout(()=>fileRef.current?.click(),100); }} style={{ background:"#141b2d",border:"1.5px solid #1e2d4a",borderRadius:14,color:"#e8eaf0",fontFamily:"inherit",fontSize:15,fontWeight:700,padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s" }} onMouseOver={e=>{e.currentTarget.style.borderColor="#c9a84c";e.currentTarget.style.background="#1a2744"}} onMouseOut={e=>{e.currentTarget.style.borderColor="#1e2d4a";e.currentTarget.style.background="#141b2d"}}>
                <span style={{ fontSize:24,width:36,height:36,background:"#c9a84c18",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center" }}>📂</span>
                <div><div>העלאת קובץ</div><div style={{ fontSize:11,color:"#7a8fa5",fontWeight:400 }}>בחר מהמכשיר</div></div>
              </button>
            </div>
          </div>
        )}

        <div style={{ background:"#0a0f1e",borderTop:"1px solid #1e2d4a",padding:"10px 12px 12px" }}>
          {/* Layout: [Clip] [Input] [Mic] [Send] */}
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            <button onClick={()=>setShowFilePicker(p=>!p)} disabled={load} aria-label="צרף מסמך רפואי" title="צרף מסמך" style={{ ...btnSm,opacity:load?.35:1 }}>📎</button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) sendDoc(f); e.target.value=""; }}/>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) sendDoc(f); e.target.value=""; }}/>
            <div style={{ flex:1,position:"relative",display:"flex",alignItems:"center" }}>
              <input ref={inpRef} aria-label="הקלד הודעה" style={{ width:"100%",background:"#141b2d",border:"1px solid #1e2d4a",borderRadius:10,color:"#fff",fontFamily:"inherit",fontSize:14,padding:"0 14px",outline:"none",height:42,direction:"rtl" }} placeholder={mic?"🎙️ מקשיב...":"כתוב, דבר, או צרף מסמך..."} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();send(inp);} }} onFocus={()=>setTimeout(()=>inpRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}),300)}/>
              {mic && <div style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",display:"flex",gap:3,alignItems:"center" }}>{[0,.15,.3,.45,.6].map(d=><span key={d} style={{ display:"inline-block",width:3,height:12,background:"#22c55e",borderRadius:2,animation:"wave 1s ease-in-out infinite",animationDelay:`${d}s` }}/>)}</div>}
            </div>
            <button onClick={toggleMic} aria-label={mic?"עצור הקלטה":"הקלט קול"} style={{ ...btnSm,background:mic?"#22c55e22":"#141b2d",borderColor:mic?"#22c55e":"#1e2d4a",color:mic?"#22c55e":"#c9a84c",animation:mic?"micPulse 1.5s ease-in-out infinite":"none" }}>{mic?"⏹️":"🎙️"}</button>
            <button onClick={()=>send(inp)} disabled={load||!inp.trim()} aria-label="שלח הודעה" style={{ background:"#c9a84c",color:"#0a0f1e",border:"none",borderRadius:10,fontWeight:700,fontSize:16,width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:(load||!inp.trim())?.35:1 }}>➤</button>
          </div>
          {docName && <p style={{ textAlign:"center",fontSize:12,color:"#c9a84c",marginTop:6 }}>{load ? "📤 מעלה ומנתח" : "🔍 מנתח"}: {docName}...</p>}
          <p style={{ textAlign:"center",fontSize:11,color:"#2a3545",marginTop:6 }}>הערכה ראשונית בלבד • אינה מהווה ייעוץ משפטי • המידע אינו נשמר</p>
        </div>
        {/* Floating WhatsApp icon inside chat */}
        <button onClick={()=>window.location.href=`https://wa.me/${WA}?text=${encodeURIComponent(waMsg)}`} aria-label="שיחת וואטסאפ עם עו״ד אלון" title="וואטסאפ" style={{ position:"absolute",bottom:76,left:12,background:"#25d366",color:"#fff",border:"none",borderRadius:"50%",width:38,height:38,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px #25d36644",zIndex:5,transition:"transform .2s" }} onMouseOver={e=>e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}>💬</button>
      </div>
      <style>{`
        @keyframes bl{0%,80%,100%{opacity:.15}40%{opacity:1}}
        @keyframes wave{0%,100%{height:4px;opacity:.4}50%{height:16px;opacity:1}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 #22c55e44}50%{box-shadow:0 0 0 8px #22c55e00}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
      `}</style>
    </div>
  );
}
