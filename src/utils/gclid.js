const STORAGE_KEY = "nifgati_gclid";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function captureGclid() {
  const params = new URLSearchParams(window.location.search);
  const gclid = params.get("gclid");

  // Always capture UTM params if present
  const utm = {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
  };
  if (utm.utm_source || utm.utm_medium || utm.utm_campaign) {
    try { localStorage.setItem("nifgati_utm", JSON.stringify(utm)); } catch {}
  }

  // Capture GCLID if present in URL
  if (gclid) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ gclid, ts: Date.now() }));
    } catch {}
  }
}

export function getGclid() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const { gclid, ts } = JSON.parse(raw);
    if (Date.now() - ts > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return "";
    }
    return gclid || "";
  } catch {
    return "";
  }
}

export function getUtm() {
  try {
    return JSON.parse(localStorage.getItem("nifgati_utm") || "{}");
  } catch {
    return {};
  }
}
