import LandingPage from "../LandingPage.jsx";
export default function Nechut() {
  return <LandingPage
    pageTitle="קיבלת אחוזי נכות? גלה כמה שווה כל אחוז"
    pageSubtitle="נכות 5%? 10%? 20%? כל אחוז שווה סכום שונה — חשב עכשיו"
    heroEmoji="📋"
    bullets={["כל אחוז נכות = עשרות אלפי שקלים","חישוב לפי גיל, שכר ואחוז הנכות שלך","הנתונים לא נשמרים ולא מתועדים"]}
    ctaText="חשב כמה שווה הנכות שלך"
    pageSlug="nechut"
    socialProofAmount="₪185,000"
    socialProofLabel="נכות 10% — תאונת דרכים"
    bannerText="אחוזי נכות — חשב ודע מיד כמה מגיע לך"
  />;
}
