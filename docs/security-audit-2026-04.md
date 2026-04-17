# Security & QA Audit — MedicalBot (Step 3)

## Metadata

- **Date:** 2026-04-17
- **Auditor:** Claude Code
- **Scope (files in review):**
  - `src/MedicalBot.jsx`
  - `src/constants/medicalSystemPrompt.js`
  - `src/pages/RashlanutRefuit.jsx`
  - `api/claude.js`
  - `api/crm.js`
- **Out of scope:** the rest of the site (pl"t bot, other landing pages, shared infra). A separate full-site security audit is planned and will cover rate-limit architecture, secret rotation, CSP/headers beyond this bot, and observability.

## Threat model summary

The MedicalBot collects sensitive personal data from users exploring a potential medical-malpractice claim: full name, Israeli mobile number, free-text narrative of a medical incident (likely to contain health information, provider names, and clinical detail), institution type, and dates. This data is forwarded to Anthropic's API (narrative only, for category detection) and persisted to a Google Sheets CRM (full lead). Relevant adversaries: (1) drive-by abusers hitting the API endpoints to burn budget, (2) prompt-injection attempts embedded in free-text, (3) CSV-formula injection targeting the sheet recipient, (4) opportunistic scraping of the client bundle for exposed keys, and (5) the user themselves typing inconsistent data (typos, non-logical dates) that could produce misleading legal output back to them.

## Executive summary

The three highest-impact items from this pass:

1. **Fix 3 (MAJOR) — Softened legal-compliance wording in user-facing copy and the WhatsApp hand-off text.** Previous copy said "זוהו N סוגיות" / "זיהינו N סוגיות" which reads as a confirmed legal finding. Replaced with "עלו N סוגיות לבדיקה מעמיקה" — framed as items for further review, not determinations. Reduces unauthorized-practice-of-law exposure on an unregulated triage surface.
2. **Fix 9 (MAJOR) — Raised medical bot `max_tokens` from 150 → 200** in `api/claude.js`. At 150 the model was occasionally truncating its JSON array of detected categories mid-token, causing the client's `JSON.parse` to fail and the user to see "no issues detected" even when there were. This silently degraded the core detection feature.
3. **Fix 1 (MINOR, most consequential of the minors) — SOL calculation now ignores a discovery date earlier than the incident date.** Previously, a user typo ("discovery = 2019, incident = 2020") would base the 7-year statute-of-limitations countdown on the earlier date and show an incorrect, user-facing legal timeline. Since SOL output is directly shown to the user as guidance, correctness here matters.

## Findings

| ID | Severity | Category | File / Location | Description | Status | Reasoning (if skipped) |
|---|---|---|---|---|---|---|
| 1 | Minor | Correctness | `src/MedicalBot.jsx:38-53` (`calcSol`) | SOL countdown used `discoveryISO \|\| incidentISO` with no validation — a discovery date earlier than the incident produced an earlier, incorrect deadline. | Fixed | — |
| 2 | Minor | Integrity | `src/MedicalBot.jsx:188-220` (`submitLead`) | Rapid double-click on submit could fire two CRM writes before `leadSubmitting` propagated. | Fixed | — |
| 3 | **MAJOR** | Legal / UPL | `src/MedicalBot.jsx:109-119`, `:370-379` | User-facing copy and WhatsApp text said "זוהו/זיהינו N סוגיות", implying confirmed legal findings on a pre-consult triage surface. | Fixed | — |
| 4 | Minor | Accessibility | `src/MedicalBot.jsx:253, 268, 335, 344, 353` | Step indicator had no live region; choice buttons lacked `aria-pressed`; textarea lacked `aria-label`. Screen-reader users had no signal on step changes or selections. | Fixed | — |
| 5 | Minor | Defense-in-depth | `src/MedicalBot.jsx:278-289` | Textarea length cap enforced only via JS `onChange` slice — DOM paste events or disabled JS could bypass. | Fixed | — |
| 6 | Minor | Privacy / Consent | `src/MedicalBot.jsx` step-5 lead form | No explicit consent checkbox before lead submission (only footer disclaimer + caveat block). | Skipped | Covered by planned privacy-policy update (see manual-actions doc). A checkbox is a product decision; the privacy copy needs to land first. Revisit in full-site audit. |
| 7 | Minor | Privacy | `src/MedicalBot.jsx:210` | `navigator.userAgent` is forwarded to the CRM without explicit disclosure. | Skipped | UA is needed for fraud/debug context and is minimally identifying; will be disclosed in the updated privacy policy (see manual-actions doc). |
| 8 | Minor | Observability | `api/claude.js:188` | API log line didn't include domain tag — medical vs pl"t traffic was indistinguishable in Vercel logs. | Fixed | — |
| 9 | **MAJOR** | Availability / Correctness | `api/claude.js:204` | Medical `max_tokens: 150` truncated the JSON category array; `JSON.parse` at `MedicalBot.jsx:83` then silently dropped detected categories. | Fixed | — |
| 10 | Minor | Rate limiting | `api/claude.js:37-58`, `api/crm.js:116-126` | Rate limit is shared across domains and in-memory only (resets on cold start, not distributed across Vercel instances). | Skipped | In-memory is acceptable for current traffic; distributed limiting with Vercel KV belongs in the full-site audit alongside other infra work. |
| 11 | Informational | Code hygiene | `api/claude.js:113-127` | Message merge uses shallow `{ ...m }`; nested content arrays share references. Downstream code only reads, so no exploit path, but fragile. | Skipped | No exploitable path; reviewed and accepted. |
| 12 | Minor | Prompt injection | `api/claude.js:151-167` (`INJECTION_RE`) | Regex-based injection filter is bypassable via unicode tricks, paraphrase, or role-play framing. | Skipped | Regex is belt-and-suspenders; primary defense is the system prompt's role boundaries and the narrow JSON-output contract. A proper injection review (input normalization, model-based classifier) belongs in the full-site audit. |
| 13 | Minor | Availability | `api/crm.js:225-231` (medical branch) | If the Medical tab in the target spreadsheet was missing/renamed, `appendRow` returned 400 and the lead was lost with only a server-log trace. | Fixed | — (added `ensureSheetExists` + canonical `MEDICAL_HEADERS`) |
| 14 | Informational | Data integrity | `api/crm.js:104-109, 188-204` | `MEDICAL_HEADERS` order and the `row` array order are coupled by convention only — no test asserts they stay in sync. | Skipped | Both live in the same ~30-line block; drift is visually obvious. A test is overkill for the current scope. |
| 15 | Minor | Resource | `api/crm.js:112-126` | The CRM rate-limit `Map` has no periodic cleanup (unlike `api/claude.js` which evicts every 2 min). | Skipped | Serverless cold-start resets the map; 20 keys/min × cold-start interval is bounded. Tidy-up belongs in the full-site audit. |
| 16 | Informational | Prompt design | `src/constants/medicalSystemPrompt.js` | Reviewed for hallucinated diagnostic-sounding output and cross-category bleed. | Skipped | Boundaries and whitelist are tight; no change required. |
| 17 | Informational | Page | `src/pages/RashlanutRefuit.jsx` | Verified page-specific content is passed as props to the shared `LandingPage`, not edited into the shared component (per project convention). | Skipped | No deviation found. |

## Fixes applied

1. **Fix 1** — `src/MedicalBot.jsx:38-42` — `calcSol` discards discovery date when earlier than incident date.
2. **Fix 2** — `src/MedicalBot.jsx:190` — `submitLead` early-returns on `leadSubmitting \|\| leadSubmitted`.
3. **Fix 3 (MAJOR)** — `src/MedicalBot.jsx:113, 372, 378` — "זוהו / זיהינו" replaced with "עלו … לבדיקה מעמיקה" in result screen and WhatsApp text.
4. **Fix 4** — `src/MedicalBot.jsx:253, 268, 285, 335, 344, 353` — added `role="status" aria-live="polite"` to step counter, `aria-pressed` on case-type / permanent-damage / records / institution buttons, `aria-label` on textarea.
5. **Fix 5** — `src/MedicalBot.jsx:286` — native `maxLength={2000}` added to textarea as defense-in-depth.
6. **Fix 8** — `api/claude.js:188` — request log line now includes `domain=...` tag.
7. **Fix 9 (MAJOR)** — `api/claude.js:204` — `max_tokens` for medical domain raised from 150 to 200.
8. **Fix 13** — `api/crm.js:77-109, 227-229` — added `ensureSheetExists` best-effort helper and `MEDICAL_HEADERS` constant; medical branch auto-creates the tab with a canonical header row if missing.

## Verification

`npm run build` passes — 59 modules, no warnings.

## Signature

Claude Code — 2026-04-17
