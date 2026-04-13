import { useState } from "react";
import LandingPage from "../LandingPage.jsx";

function getUtmTerm() {
  const raw = new URLSearchParams(window.location.search).get("utm_term");
  if (!raw) return "";
  return decodeURIComponent(raw.replace(/\+/g, " ")).trim().toLowerCase();
}

function getDynamicTitle() {
  const term = getUtmTerm();

  if (term.includes('כאב וסבל') || term.includes('חישוב'))
    return 'מחשבון כאב וסבל פלת״ד — חשב כמה מגיע לך';

  if (term.includes('מחשבון') || term.includes('פיצויים'))
    return 'מחשבון פיצויים תאונת דרכים — תוצאה תוך דקה';

  if (term.includes('נזק גוף'))
    return 'מחשבון נזק גוף — חשב את הפיצוי שלך';

  return 'מחשבון פיצויים חינמי — כמה מגיע לך?';
}

function getDynamicSubtitle() {
  const term = getUtmTerm();

  if (term.includes('כאב וסבל') || term.includes('חישוב'))
    return 'חישוב מדויק לפי נוסחת פלת״ד — כאב וסבל, נכות, הפסד שכר';

  return 'חישוב חינמי לפי חוק הפלת״ד — תוך 60 שניות, אנונימי';
}

export default function Machshevon() {
  const [title] = useState(getDynamicTitle);
  const [subtitle] = useState(getDynamicSubtitle);

  return <LandingPage
    pageTitle={title}
    pageSubtitle={subtitle}
    heroEmoji="🧮"
    bullets={["מחשב 4 ראשי נזק לפי חוק הפלת״ד","תוצאה תוך 60 שניות — חינם ואנונימי","הנתונים לא נשמרים ולא מתועדים"]}
    ctaText="חשב פיצוי עכשיו"
    pageSlug="machshevon"
    socialProofLabel="ממוצע תיק שטופל"
    bannerText="מחשבון פיצויים — חשב ודע מיד כמה מגיע לך"
  />;
}
