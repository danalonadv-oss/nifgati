import { sendToCrm } from "./crm.js";

const WA = "972544338212";
const DEFAULT_MSG = "שלום דן, אני מעוניין לבדוק את זכאותי לפיצוי בתאונת דרכים";

let lastFiredPath = null;

export function openWhatsApp(location) {
  const url = `https://wa.me/${WA}?text=${encodeURIComponent(DEFAULT_MSG)}`;
  const currentPath = window.location.pathname;

  // Fire once per page path — resets on SPA navigation
  if (lastFiredPath !== currentPath) {
    lastFiredPath = currentPath;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "whatsapp_click", button_location: location || currentPath });
  }

  // CRM: log WhatsApp click from landing page (no bot data)
  const params = new URLSearchParams(window.location.search);
  sendToCrm({
    page: currentPath,
    whatsappClick: true,
    utmSource: params.get("utm_source") || "",
  });

  window.open(url, "_blank", "noopener,noreferrer");
}

export function getWhatsAppUrl() {
  return `https://wa.me/${WA}?text=${encodeURIComponent(DEFAULT_MSG)}`;
}
