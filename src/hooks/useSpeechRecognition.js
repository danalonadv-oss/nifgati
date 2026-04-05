import { useState, useRef } from "react";

export default function useSpeechRecognition({ setInp, setErr }) {
  const [mic, setMic] = useState(false);
  const micRef = useRef(null);

  function toggleMic() {
    if (mic) {
      if (micRef.current) { try { micRef.current.stop(); } catch (e) {} }
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

    r.onstart = () => { setMic(true); setErr(""); };
    r.onresult = e => { setInp(e.results[0][0].transcript); setMic(false); };
    r.onend = () => setMic(false);
    r.onerror = e => {
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

    try { r.start(); } catch (e) { setMic(false); setErr("זיהוי קול לא זמין כרגע — נסה לרענן את הדף."); }
  }

  return { mic, toggleMic };
}
