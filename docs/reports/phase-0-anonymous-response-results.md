# Phase 0 — Anonymous Response PoC Results

> Status: Completed — Accept with Limitations  
> Test Date: 2026-09-18  
> Specification: `docs/specs/phase-0-anonymous-response-poc.md`

## 1. Environment

| Item | Value |
|---|---|
| Test Google account type | Dedicated test account; account type not recorded |
| Apps Script deployment ID | Record a redacted identifier only |
| Static hosting origin | localhost |
| Browser and version | Chrome; version not recorded |
| Spreadsheet | Dedicated test spreadsheet |

## 2. Local Automated Checks

Executed on 2026-09-18 with Node.js v22.20.0:

```text
6 tests passed
0 tests failed
```

Covered behavior:

- Valid payload normalization.
- Client-supplied destination rejection.
- Unknown answer field rejection.
- Unsupported Schema version rejection.
- Invalid email rejection.
- Spreadsheet formula marker neutralization.

These checks do not prove Google authorization, CORS, redirect or Sheet-write behavior.

## 3. Acceptance Results

| Scenario | Result | Evidence / Notes |
|---|---|---|
| AC-P0-01 Valid Anonymous Submission | Pass | Manually verified in Chrome without respondent login |
| AC-P0-02 Fixed Destination | Pass | Local validation and deployed behavior manually verified |
| AC-P0-03 Unknown Field | Pass | Automated check and deployed behavior manually verified |
| AC-P0-04 Invalid Schema Version | Pass | Automated check and deployed behavior manually verified |
| AC-P0-05 Formula-like Input | Pass | Automated transformation and Sheet result manually verified |
| AC-P0-06 Oversized Payload | Pass | Manually verified against deployed endpoint |
| AC-P0-07 Submission Failure | Pass | Browser could distinguish success and failure in the tested environment |
| AC-P0-08 Credential Inspection | Pass | No Creator credential observed in public client or network traffic |
| AC-P0-09 Duplicate Submission | Pass | Repeated `submissionId` did not create a second row |
| AC-P0-10 Untrusted Origin | Pass | Cross-origin localhost submission behavior manually verified |

## 4. Deployment and Authorization Evidence

The Apps Script Web App was deployed and tested from Chrome against a localhost-hosted Static Form. The product owner reported all acceptance scenarios passing. No OAuth tokens, complete deployment URLs, private Spreadsheet IDs or personal data are stored in this report.

Evidence level: manual product-owner report. Screenshots, browser version, sanitized network captures and execution logs were not committed to the repository.

## 5. CORS and Response Readability

In the tested Chrome/localhost environment:

- POST reached `doPost`.
- The browser followed the Apps Script redirect.
- Browser JavaScript read and parsed the JSON response.
- The UI distinguished successful and failed submissions without an opaque `no-cors` response.

This result must be rechecked on the selected production Static Hosting origin and supported browsers before release.

## 6. Quotas and Operational Limits

Official Apps Script documentation states that quotas vary by account type, are subject to change, and quota exhaustion causes execution failures. Record the values observed and relevant official documentation date during deployment testing.

Official reference: https://developers.google.com/apps-script/guides/services/quotas

## 7. Security Observations

Deployed inspection was reported as passing. The implementation uses:

- Trusted destination values from Script Properties.
- Strict request and answer allowlists.
- Server-generated received time.
- Formula marker neutralization.
- Script locking and `submissionId` duplicate detection.
- Safe public error codes.

Known residual risk: the public endpoint can be invoked by parties other than the intended form page. Origin is not an authentication mechanism and no CAPTCHA or dedicated rate limiter is implemented.

## 8. Decision

**Accept with Limitations.** Google Apps Script is accepted as the MVP response-submission mechanism, subject to ADR-001.

Remaining limitations:

- The successful cross-origin result currently covers Chrome and localhost only.
- The public endpoint has no CAPTCHA or dedicated distributed rate limiter.
- Apps Script and Google Sheets quotas may interrupt submissions.
- Creator setup and deployment are manual.
- Manual evidence should be strengthened with sanitized artifacts and multi-browser tests before production release.
