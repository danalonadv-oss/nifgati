# Manual Actions — MedicalBot Security Pass (2026-04-17)

These items require human action outside the codebase. They complement the findings in `security-audit-2026-04.md`.

> **Scope note:** this document is MedicalBot-scope only. A separate full-site security audit is planned and will cover infrastructure concerns (Cloudflare / WAF, distributed rate limiting, Sentry / error monitoring, secret rotation, CSP tightening). Please do **not** add those items here — they'll live in the full-site doc.

---

## 1. Verify `GOOGLE_SHEET_NAME_MEDICAL` in Vercel, or document the fallback

- **What:** Confirm the Vercel project has the environment variable `GOOGLE_SHEET_NAME_MEDICAL` set to the tab name used for medical leads. If intentionally unset, document that behaviour.
- **Why:** `api/crm.js:221-223` falls back to the literal string `"Medical"` when the env var is absent. The new `ensureSheetExists` helper (fix 13) will auto-create a tab named `"Medical"` on first write if that fallback kicks in — so the system is safe, but the operator should *intend* that tab name rather than inherit it by accident. If the production sheet uses a different Hebrew tab name and the env var is unset, leads would silently land in a new auto-created `"Medical"` tab.
- **How:**
  1. Open Vercel → project `nifgati` → Settings → Environment Variables.
  2. Search for `GOOGLE_SHEET_NAME_MEDICAL`. If present, note the value and confirm the tab exists in the target spreadsheet (`GOOGLE_SPREADSHEET_ID`).
  3. If absent, decide: either (a) set it explicitly to the desired tab name, or (b) accept `"Medical"` as the canonical tab name and verify or create that tab.
  4. After any change, redeploy and submit a test medical lead; confirm the row lands in the correct tab.
- **Priority:** urgent (lead capture is revenue-critical; a silent misrouting goes unnoticed until someone reviews the CRM).

---

## 2. Confirm no service-account JSON is present in git history

- **What:** Verify that no Google service-account key (or any `credentials.json` / `*service*.json`) has ever been committed to the repo.
- **Why:** The CRM integration uses `GOOGLE_PRIVATE_KEY` + `GOOGLE_CLIENT_EMAIL` from Vercel env vars, which is correct. But if a raw service-account JSON was ever committed — even briefly — the key must be considered compromised and rotated, even after removal.
- **How:**
  Ran: `git log --all --name-only | grep -i 'credentials\|service\|\.json'`
  Result (file paths only, stripped of commit-message noise): `package.json`, `package-lock.json`, `vercel.json`.
  **No credentials or service-account JSONs found in history.** No rotation required on this basis.
  Re-run this command any time a secret rotation question comes up, or after any operational incident:
  ```
  git log --all --name-only | grep -i 'credentials\|service\|\.json'
  ```
- **Priority:** eventually (already verified clean; re-check on incident or when onboarding new Google services).

---

## 3. Update the privacy policy (`/privacy` page) to reflect current data flows

- **What:** Revise `src/Privacy.jsx` so the `/privacy` page accurately lists every third party and data category currently in use.
- **Why:** The MedicalBot and the pl"t bot both collect personally identifiable information, and the medical bot additionally collects free-text that is likely to contain health information. Users have a legal/ethical right to know where their data goes. The current privacy copy predates several integrations and must be refreshed before further marketing push on `/rashlanut-refuit`.
- **How:** The privacy page must explicitly mention:
  1. **Google Sheets** — leads (name, phone, free-text narrative, dates, domain, GCLID, user-agent) are stored in a Google Sheets CRM. State retention expectations.
  2. **Resend** — transactional email notifications (see `api/notify.js`) containing lead summary go to the firm inbox.
  3. **UserWay** — accessibility widget loaded from a third-party domain.
  4. **Google Tag Manager (GTM) and GA4** — site analytics and conversion tracking.
  5. **Anthropic API (Claude)** — free-text narrative from both bots is sent to Anthropic for classification/response generation. Note that this narrative may contain health information on the medical bot and injury/accident detail on the pl"t bot.
  6. **Both bots (pl"t and medical) collect PII** — including free-text that may include health information.
  7. A plain-language line on the user's right to request deletion and the contact method to do so.
- **Priority:** soon (before any paid traffic to `/rashlanut-refuit` scales up). This also unblocks finding #6 (consent checkbox) in the audit — the consent copy needs the privacy page in place first.

---

## Out of scope — deferred to full-site audit

The following items were raised during this pass but belong in the upcoming site-wide audit. Listed here only so they aren't forgotten:

- Distributed rate limiting (e.g., Vercel KV) vs the current in-memory `Map` in `api/claude.js` and `api/crm.js`.
- WAF / Cloudflare in front of the Vercel deployment.
- Error monitoring (Sentry or equivalent) to catch silent degradations like the fix-9 truncation.
- CSP tightening beyond the current `vercel.json` header.
- Secret rotation cadence and a documented runbook.
- Prompt-injection defense beyond the regex in `api/claude.js:151-167`.

Do **not** address these in this document — they belong in the full-site audit's manual-actions list.
