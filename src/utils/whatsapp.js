import { sendToCrm } from "./crm.js";

const WA = "972544338212";
const DEFAULT_MSG = "שלום דן, אני מעוניין לבדוק את זכאותי לפיצוי בתאונת דרכים";

let firedWaClick = false;

export function openWhatsApp(location) {
  const url = `https://wa.me/${WA}?text=${encodeURIComponent(DEFAULT_MSG)}`;

  if (!firedWaClick) {
    firedWaClick = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "whatsapp_click", button_location: location || window.location.pathname });
    console.log("[nifgati] whatsapp_click fired (landing)", location);
  }

  // CRM: log WhatsApp click from landing page (no bot data)
  const params = new URLSearchParams(window.location.search);
  sendToCrm({
    page: window.location.pathname,
    whatsappClick: true,
    utmSource: params.get("utm_source") || "",
  });

  window.open(url, "_blank", "noopener,noreferrer");
}

export function getWhatsAppUrl() {
  return `https://wa.me/${WA}?text=${encodeURIComponent(DEFAULT_MSG)}`;
}
