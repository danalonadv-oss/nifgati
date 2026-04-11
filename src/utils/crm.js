// Send lead data to /api/crm (Google Sheets)
// Fire-and-forget — never blocks the user flow

export function sendToCrm(leadData) {
  fetch("/api/crm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leadData),
  }).catch(() => {});
}
