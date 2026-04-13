import { useRef, useEffect, useState } from "react";
import useChat from "./hooks/useChat";
import useFileUpload from "./hooks/useFileUpload";
import useSpeechRecognition from "./hooks/useSpeechRecognition";
import s from "./styles/Bot.module.css";

export default function Bot({ onClose, inline = false, openingMessage }) {
  const {
    msgs, inp, setInp, load, setLoad, calc, err, setErr,
    showReferral, send, sendDoc, waMsg, endRef, WA, notifyWhatsApp,
    quickReplies, handleQuickReply, progress, data,
  } = useChat(openingMessage);

  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSending, setLeadSending] = useState(false);

  function roleLabel(r) {
    const m = { driver:"נהג", passenger:"נוסע", pedestrian:"הולך רגל", motorcycle:"אופנוע", scooter:"קורקינט", car:"רכב", work:"תאונת עבודה" };
    return m[r] || "";
  }

  async function submitLead(e) {
    e.preventDefault();
    if (!leadName.trim() || !leadPhone.trim() || leadSending) return;
    setLeadSending(true);
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "calculator_lead",
          name: leadName.trim(),
          phone: leadPhone.trim(),
          estimate_min: calc?.min,
          estimate_max: calc?.max,
          accident_type: roleLabel(data.role),
          age: data.age,
          medical: data.medical ? "כן" : "לא",
          work_related: data.isWork ? "כן" : "לא",
          disability_percent: data.disability,
          source: window.location.pathname,
          timestamp: new Date().toISOString(),
        }),
      });
      setLeadSubmitted(true);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "lead_form_submit", form_name: "bot_lead_form", page_slug: window.location.pathname });
    } catch { setLeadSubmitted(true); }
    setLeadSending(false);
  }

  const calcWaHref = calc
    ? `https://wa.me/${WA}?text=${encodeURIComponent(`היי, השתמשתי במחשבון הפיצויים באתר נפגעתי. הפיצוי המשוער שלי: ₪${calc.min.toLocaleString("he-IL")}–₪${calc.max.toLocaleString("he-IL")}. אשמח לייעוץ.`)}`
    : `https://wa.me/${WA}`;

  const {
    docName, setDocName, showFilePicker, setShowFilePicker,
    fileRef, camRef, processFile,
  } = useFileUpload();

  const { mic, toggleMic } = useSpeechRecognition({ setInp, setErr });
  const inpRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const calcRef = useRef(null);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
  }, [msgs, load]);

  useEffect(() => {
    if (calc && calcRef.current) {
      setTimeout(() => {
        calcRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [calc]);

  const resultsCard = calc && !load && (
    <div ref={calcRef} style={{ background:"linear-gradient(135deg, #1a2744, #0f1a30)", border:"1px solid #c9a84c55", borderRadius:16, padding:"20px 18px" }}>
      {/* Estimate amount */}
      <div style={{ fontSize:11, color:"#c9a84c", letterSpacing:1, marginBottom:6, fontWeight:700 }}>הפיצוי המשוער שלך</div>
      <div style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:4 }}>₪{calc.min.toLocaleString("he-IL")} – ₪{calc.max.toLocaleString("he-IL")}</div>
      <div style={{ fontSize:12, color:"#556070", marginBottom:8 }}>לפני שכ"ט (8%–13%)</div>
      <p style={{ fontSize:11, color:"#7a8fa5", textAlign:"center", margin:"4px 0 14px", lineHeight:1.5 }}>* הערכה ראשונית בלבד. אינה מהווה ייעוץ משפטי.</p>
      <div style={{ fontSize:14, color:"#e8edf2", textAlign:"center", marginBottom:16, fontWeight:700 }}>רוצה לקבל הערכה מדויקת ולמצות את הסכום?</div>

      {/* Lead form */}
      {!leadSubmitted ? (
        <form onSubmit={submitLead} style={{ background:"#0d1425", border:"2px solid #c9a84c", borderRadius:14, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#c9a84c", marginBottom:10, textAlign:"center" }}>רוצים שנחזור אליכם?</div>
          <input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="שם מלא" required
            style={{ width:"100%", background:"#141b2d", border:"1px solid #1e2d4a", borderRadius:10, color:"#fff", fontFamily:"inherit", fontSize:14, padding:"10px 14px", marginBottom:8, direction:"rtl", boxSizing:"border-box" }} />
          <input value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="טלפון" type="tel" required
            style={{ width:"100%", background:"#141b2d", border:"1px solid #1e2d4a", borderRadius:10, color:"#fff", fontFamily:"inherit", fontSize:14, padding:"10px 14px", marginBottom:10, direction:"ltr", boxSizing:"border-box" }} />
          <button type="submit" disabled={leadSending}
            style={{ width:"100%", background:"#c9a84c", color:"#060a12", border:"none", borderRadius:12, fontFamily:"inherit", fontWeight:800, fontSize:15, padding:"13px", cursor:"pointer" }}>
            {leadSending ? "שולח..." : "חזרו אליי בבקשה \u2190"}
          </button>
        </form>
      ) : (
        <div style={{ background:"#0d1425", border:"2px solid #22c55e", borderRadius:14, padding:16, marginBottom:12, textAlign:"center" }}>
          <div style={{ fontSize:20, marginBottom:6 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#22c55e", marginBottom:4 }}>קיבלנו את פרטייך!</div>
          <div style={{ fontSize:12, color:"#7a8fa5" }}>נחזור אליך תוך שעה בשעות הפעילות.</div>
        </div>
      )}

      {/* WhatsApp button */}
      <a href={calcWaHref} onClick={() => notifyWhatsApp()} target="_blank" rel="noopener noreferrer"
        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", background:"#25D366", color:"#fff", border:"none", borderRadius:12, fontFamily:"inherit", fontWeight:700, fontSize:14, padding:"13px", cursor:"pointer", textDecoration:"none", marginBottom:8, boxSizing:"border-box" }}>
        💬 דברו איתנו עכשיו בוואטסאפ
      </a>

      {/* Phone button */}
      <a href="tel:+972544338212"
        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", background:"transparent", color:"#fff", border:"2px solid #ffffff44", borderRadius:12, fontFamily:"inherit", fontWeight:700, fontSize:16, padding:"14px", cursor:"pointer", textDecoration:"none", marginBottom:10, boxSizing:"border-box" }}>
        📞 חייגו עכשיו
      </a>

      <p style={{ fontSize:11, color:"#556070", textAlign:"center", margin:0 }}>ייעוץ ראשוני ללא עלות וללא התחייבות</p>
    </div>
  );

  async function handleFile(file) {
    if (load) return;
    setErr("");
    setLoad(true);
    setDocName(file.name);
    try {
      const { userContent, displayName } = await processFile(file);
      await sendDoc(userContent, displayName);
    } catch (e) {
      setErr(e.message || "שגיאה בניתוח המסמך");
    }
    setLoad(false);
    setDocName("");
  }

  const waHref = `https://wa.me/${WA}?text=${encodeURIComponent(waMsg)}`;

  // ── Inline mode: no overlay, no close button, no floating WA FAB ──
  if (inline) {
    return (
      <div className={s.inlineWrap}>
        <div className={s.inlineContainer}>
          {/* ── Header ── */}
          <div className={s.header}>
            <div className={s.title}>🤖 בוט הפיצויים</div>
            <div className={s.headerRight}>
              <span className={s.statusText}>
                <span className={s.statusDot} />
                השיחה לא נשמרת ולא מתועדת
              </span>
              <a href="tel:0544338212" aria-label="התקשר לעו״ד אלון" title="התקשר" className={s.phoneBtn}>📞</a>
            </div>
          </div>

          {/* ── Progress Bar ── */}
          {progress > 0 && (
            <div style={{ padding:"8px 12px 0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#7a8fa5", marginBottom:4 }}>
                <span>התקדמות החישוב</span>
                <span>{progress}%</span>
              </div>
              <div style={{ background:"#1e2d4a", borderRadius:4, height:4 }}>
                <div style={{ background:"#c9a84c", height:4, borderRadius:4, width:`${progress}%`, transition:"width 0.5s ease" }} />
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          <div ref={messagesContainerRef} className={s.messages}>
            {msgs.map((m, i) => (
              <div key={i} className={`${s.msgRow} ${m.role === "user" ? s.msgRowUser : s.msgRowBot}`}>
                <div className={`${s.bubble} ${m.role === "user" ? s.bubbleUser : s.bubbleBot}`}>{m.content}</div>
              </div>
            ))}

            {/* ── Quick Reply Buttons ── */}
            {quickReplies.length > 0 && !load && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"8px 0", justifyContent:"center" }}>
                {quickReplies.map((qr, i) => (
                  <button key={i} onClick={() => handleQuickReply(qr.value)}
                    style={{ flex:"0 0 auto", maxWidth:"calc(50% - 4px)", background:"#0d1425", border:"1px solid #c9a84c", borderRadius:20, color:"#c9a84c", padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

            {load && (
              <div className={s.loadWrap}>
                <div role="status" aria-label="הבוט מקליד..." className={s.loadBubble}>
                  <span className={s.srOnly}>הבוט מקליד...</span>
                  {[0, .2, .4].map(d => <span key={d} aria-hidden="true" className={s.loadDot} style={{ animationDelay: `${d}s` }} />)}
                </div>
              </div>
            )}

            {resultsCard}

            {showReferral && !calc && (
              <div className={s.referralWrap}>
                <button onClick={() => { notifyWhatsApp(); window.location.href = waHref; }} className={s.referralBtn}>
                  📱 שליחת הנתונים לעו"ד אלון ובדיקת זכאות בוואטסאפ
                </button>
              </div>
            )}

            {err && (
              <div role="alert" className={s.alert}>
                <span>{err}</span>
                <button onClick={() => setErr("")} aria-label="סגור הודעת שגיאה" className={s.alertClose}>✕</button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ── File Picker Modal ── */}
          {showFilePicker && (
            <div onClick={() => setShowFilePicker(false)} className={s.pickerOverlay}>
              <div onClick={e => e.stopPropagation()} className={s.pickerModal}>
                <div className={s.pickerHeader}>
                  <span className={s.pickerTitle}>📎 צירוף מסמך רפואי</span>
                  <button onClick={() => setShowFilePicker(false)} className={s.closeBtn}>✕</button>
                </div>
                <p className={s.pickerHint}>PDF, תמונה, או מסמך Word — עד 10MB</p>
                <button onClick={() => { setShowFilePicker(false); setTimeout(() => camRef.current?.click(), 100); }} className={s.pickerBtn}>
                  <span className={s.pickerIcon}>📷</span>
                  <div><div>צילום מסמך</div><div className={s.pickerSub}>פתח מצלמה וצלם</div></div>
                </button>
                <button onClick={() => { setShowFilePicker(false); setTimeout(() => fileRef.current?.click(), 100); }} className={s.pickerBtn}>
                  <span className={s.pickerIcon}>📂</span>
                  <div><div>העלאת קובץ</div><div className={s.pickerSub}>בחר מהמכשיר</div></div>
                </button>
              </div>
            </div>
          )}

          {/* ── WhatsApp Button — hidden when calc card has its own ── */}
          {!calc && (
            <div style={{ padding:"6px 12px", borderTop:"1px solid #ffffff11", display:"flex", justifyContent:"center" }}>
              <a href={waHref} onClick={() => notifyWhatsApp()}
                style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#25D366", color:"#fff", borderRadius:20, padding:"8px 20px", fontSize:13, fontWeight:700, textDecoration:"none", fontFamily:"inherit" }}>
                💬 דבר עם דן עכשיו — חינם
              </a>
            </div>
          )}

          {/* ── Input Bar ── */}
          <div className={s.inputBar}>
            <div className={s.inputRow}>
              <button onClick={() => setShowFilePicker(p => !p)} disabled={load} aria-label="צרף מסמך רפואי" title="צרף מסמך" className={`${s.btnSm} ${load ? s.btnSmDisabled : ""}`}>📎</button>
              <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              <input ref={fileRef} type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              <div className={s.inputWrap}>
                <input ref={inpRef} aria-label="הקלד הודעה" className={s.input} placeholder={mic ? "🎙️ מקשיב..." : "כתוב, דבר, או צרף מסמך..."} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(inp); } }} onFocus={() => setTimeout(() => inpRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300)} />
                {mic && (
                  <div className={s.micWave}>
                    {[0, .15, .3, .45, .6].map(d => <span key={d} className={s.micDot} style={{ animationDelay: `${d}s` }} />)}
                  </div>
                )}
              </div>
              <button onClick={toggleMic} aria-label={mic ? "עצור הקלטה" : "הקלט קול"} className={mic ? s.micBtnActive : s.micBtn}>{mic ? "⏹️" : "🎙️"}</button>
              <button onClick={() => send(inp)} disabled={load || !inp.trim()} aria-label="שלח הודעה" className={`${s.sendBtn} ${load || !inp.trim() ? s.sendBtnDisabled : ""}`}>➤</button>
            </div>
            {docName && <p className={s.docStatus}>{load ? "📤 מעלה ומנתח" : "🔍 מנתח"}: {docName}...</p>}
          </div>
          <p style={{ fontSize:10, color:"#666", textAlign:"center", padding:"4px 12px", margin:0, borderTop:"1px solid #ffffff11" }}>המידע אינו נשמר ואינו מתועד • הערכה ראשונית בלבד • אינה מהווה ייעוץ משפטי</p>
        </div>
      </div>
    );
  }

  // ── Floating/overlay mode (default — used by App.jsx homepage) ──
  return (
    <div role="dialog" aria-modal="true" aria-label="בוט פיצויים" className={s.overlay}>
      <div className={s.container}>
        {/* ── Header ── */}
        <div className={s.header}>
          <div className={s.title}>🤖 בוט הפיצויים</div>
          <div className={s.headerRight}>
            <span className={s.statusText}>
              <span className={s.statusDot} />
              השיחה לא נשמרת ולא מתועדת
            </span>
            <a href="tel:0544338212" aria-label="התקשר לעו״ד אלון" title="התקשר" className={s.phoneBtn}>📞</a>
            <button onClick={onClose} aria-label="סגור בוט" className={s.closeBtn}>✕</button>
          </div>
        </div>

        {/* ── Progress Bar ── */}
        {progress > 0 && (
          <div style={{ padding:"8px 12px 0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#7a8fa5", marginBottom:4 }}>
              <span>התקדמות החישוב</span>
              <span>{progress}%</span>
            </div>
            <div style={{ background:"#1e2d4a", borderRadius:4, height:4 }}>
              <div style={{ background:"#c9a84c", height:4, borderRadius:4, width:`${progress}%`, transition:"width 0.5s ease" }} />
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div ref={messagesContainerRef} className={s.messages}>
          {msgs.map((m, i) => (
            <div key={i} className={`${s.msgRow} ${m.role === "user" ? s.msgRowUser : s.msgRowBot}`}>
              <div className={`${s.bubble} ${m.role === "user" ? s.bubbleUser : s.bubbleBot}`}>{m.content}</div>
            </div>
          ))}

          {/* ── Quick Reply Buttons ── */}
          {quickReplies.length > 0 && !load && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"8px 0" }}>
              {quickReplies.map((qr, i) => (
                <button key={i} onClick={() => handleQuickReply(qr.value)}
                  style={{ background:"#0d1425", border:"1px solid #c9a84c", borderRadius:20, color:"#c9a84c", padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {qr.label}
                </button>
              ))}
            </div>
          )}

          {load && (
            <div className={s.loadWrap}>
              <div role="status" aria-label="הבוט מקליד..." className={s.loadBubble}>
                <span className={s.srOnly}>הבוט מקליד...</span>
                {[0, .2, .4].map(d => <span key={d} aria-hidden="true" className={s.loadDot} style={{ animationDelay: `${d}s` }} />)}
              </div>
            </div>
          )}

          {resultsCard}

          {showReferral && !calc && (
            <div className={s.referralWrap}>
              <button onClick={() => { notifyWhatsApp(); window.location.href = waHref; }} className={s.referralBtn}>
                📱 שליחת הנתונים לעו"ד אלון ובדיקת זכאות בוואטסאפ
              </button>
            </div>
          )}

          {err && (
            <div role="alert" className={s.alert}>
              <span>{err}</span>
              <button onClick={() => setErr("")} aria-label="סגור הודעת שגיאה" className={s.alertClose}>✕</button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* ── File Picker Modal ── */}
        {showFilePicker && (
          <div onClick={() => setShowFilePicker(false)} className={s.pickerOverlay}>
            <div onClick={e => e.stopPropagation()} className={s.pickerModal}>
              <div className={s.pickerHeader}>
                <span className={s.pickerTitle}>📎 צירוף מסמך רפואי</span>
                <button onClick={() => setShowFilePicker(false)} className={s.closeBtn}>✕</button>
              </div>
              <p className={s.pickerHint}>PDF, תמונה, או מסמך Word — עד 10MB</p>
              <button onClick={() => { setShowFilePicker(false); setTimeout(() => camRef.current?.click(), 100); }} className={s.pickerBtn}>
                <span className={s.pickerIcon}>📷</span>
                <div><div>צילום מסמך</div><div className={s.pickerSub}>פתח מצלמה וצלם</div></div>
              </button>
              <button onClick={() => { setShowFilePicker(false); setTimeout(() => fileRef.current?.click(), 100); }} className={s.pickerBtn}>
                <span className={s.pickerIcon}>📂</span>
                <div><div>העלאת קובץ</div><div className={s.pickerSub}>בחר מהמכשיר</div></div>
              </button>
            </div>
          </div>
        )}

        {/* ── Persistent WhatsApp Button ── */}
        <div style={{ padding:"6px 12px", borderTop:"1px solid #ffffff11", display:"flex", justifyContent:"center" }}>
          <a href={waHref} onClick={() => notifyWhatsApp()}
            style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#25D366", color:"#fff", borderRadius:20, padding:"8px 20px", fontSize:13, fontWeight:700, textDecoration:"none", fontFamily:"inherit" }}>
            💬 דבר עם דן עכשיו — חינם
          </a>
        </div>

        {/* ── Input Bar ── */}
        <div className={s.inputBar}>
          <div className={s.inputRow}>
            <button onClick={() => setShowFilePicker(p => !p)} disabled={load} aria-label="צרף מסמך רפואי" title="צרף מסמך" className={`${s.btnSm} ${load ? s.btnSmDisabled : ""}`}>📎</button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <div className={s.inputWrap}>
              <input ref={inpRef} aria-label="הקלד הודעה" className={s.input} placeholder={mic ? "🎙️ מקשיב..." : "כתוב, דבר, או צרף מסמך..."} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(inp); } }} onFocus={() => setTimeout(() => inpRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 300)} />
              {mic && (
                <div className={s.micWave}>
                  {[0, .15, .3, .45, .6].map(d => <span key={d} className={s.micDot} style={{ animationDelay: `${d}s` }} />)}
                </div>
              )}
            </div>
            <button onClick={toggleMic} aria-label={mic ? "עצור הקלטה" : "הקלט קול"} className={mic ? s.micBtnActive : s.micBtn}>{mic ? "⏹️" : "🎙️"}</button>
            <button onClick={() => send(inp)} disabled={load || !inp.trim()} aria-label="שלח הודעה" className={`${s.sendBtn} ${load || !inp.trim() ? s.sendBtnDisabled : ""}`}>➤</button>
          </div>
          {docName && <p className={s.docStatus}>{load ? "📤 מעלה ומנתח" : "🔍 מנתח"}: {docName}...</p>}
        </div>
        <p style={{ fontSize:10, color:"#666", textAlign:"center", padding:"4px 12px", margin:0, borderTop:"1px solid #ffffff11" }}>המידע אינו נשמר ואינו מתועד • הערכה ראשונית בלבד • אינה מהווה ייעוץ משפטי</p>

        {/* ── Floating WhatsApp ── */}
        <button onClick={() => { notifyWhatsApp(); window.location.href = waHref; }} aria-label="שיחת וואטסאפ עם עו״ד אלון" title="וואטסאפ" className={s.waFab}>💬</button>
      </div>
    </div>
  );
}
