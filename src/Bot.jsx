import { useRef } from "react";
import useChat from "./hooks/useChat";
import useFileUpload from "./hooks/useFileUpload";
import useSpeechRecognition from "./hooks/useSpeechRecognition";
import s from "./styles/Bot.module.css";

export default function Bot({ onClose }) {
  const {
    msgs, inp, setInp, load, setLoad, calc, err, setErr,
    showReferral, send, sendDoc, waMsg, endRef, WA, notifyWhatsApp,
  } = useChat();

  const {
    docName, setDocName, showFilePicker, setShowFilePicker,
    fileRef, camRef, processFile,
  } = useFileUpload();

  const { mic, toggleMic } = useSpeechRecognition({ setInp, setErr });
  const inpRef = useRef(null);

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

        {/* ── Messages ── */}
        <div className={s.messages}>
          {msgs.map((m, i) => (
            <div key={i} className={`${s.msgRow} ${m.role === "user" ? s.msgRowUser : s.msgRowBot}`}>
              <div className={`${s.bubble} ${m.role === "user" ? s.bubbleUser : s.bubbleBot}`}>{m.content}</div>
            </div>
          ))}

          {load && (
            <div className={s.loadWrap}>
              <div role="status" aria-label="הבוט מקליד..." className={s.loadBubble}>
                <span className={s.srOnly}>הבוט מקליד...</span>
                {[0, .2, .4].map(d => <span key={d} aria-hidden="true" className={s.loadDot} style={{ animationDelay: `${d}s` }} />)}
              </div>
            </div>
          )}

          {calc && !load && (
            <div className={s.calcCard}>
              <div className={s.calcLabel}>הערכת פיצוי ראשונית</div>
              <div className={s.calcAmount}>₪{calc.min.toLocaleString("he-IL")} – ₪{calc.max.toLocaleString("he-IL")}</div>
              <div className={s.calcFee}>לפני שכ"ט (8%–13%)</div>
              <div className={s.bounceArrow}>👇</div>
              <button onClick={() => { notifyWhatsApp(); window.location.href = waHref; }} aria-label="שלח את החישוב לעורך דין בוואטסאפ" className={s.ctaBtn}>
                💬 שלח את החישוב לעו"ד בוואטסאפ
              </button>
            </div>
          )}

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
