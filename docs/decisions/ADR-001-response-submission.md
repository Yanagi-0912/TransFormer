# ADR-001 — Anonymous Response Submission via Google Apps Script

> Status: Accepted with Limitations  
> Date: 2026-09-18  
> Decision Owners: Product Owner and TransFormer Project

## Context

TransFormer must allow an anonymous respondent to submit a public form to creator-owned storage without operating a project-owned Backend Server and without exposing the creator's Google Credential.

The architecture risk was tested before building the Visual Editor, as required by the initial specification and Phase 0 PoC specification.

## Decision

For the MVP, each published form may use a creator-owned Google Apps Script Web App as its Response Submission Endpoint:

```text
Static public form
        ↓ HTTPS POST
Creator-deployed Google Apps Script Web App
        ↓ validated append
Creator-owned Google Sheet
```

The Web App executes as the creator/deployer and permits anonymous access. Trusted destination configuration is stored in Apps Script Script Properties. The public Request cannot select the Spreadsheet or Sheet.

The current implementation is located under `poc/anonymous-response/` and is a reference for the production submission contract, not yet the final publishing implementation.

## Validation Result

On 2026-09-18, the product owner reported all Phase 0 acceptance scenarios passing using Chrome and a localhost-hosted Static Form. This included:

- Anonymous submission without Google login.
- Response JSON readable by browser JavaScript.
- Correct Sheet append.
- Fixed destination enforcement.
- Schema and field validation.
- Formula-like input neutralization.
- Duplicate `submissionId` handling.
- Safe failure reporting.
- No Creator Credential observed in the public client or network traffic.

The committed evidence is a manual result record rather than screenshots or sanitized network traces.

## Rationale

This design preserves the primary product constraints:

- TransFormer itself does not operate a Backend Server.
- Responses remain in creator-owned storage.
- Anonymous respondents do not receive creator Credentials.
- The core application remains deployable as a Static Web App.

The PoC showed that the browser could distinguish submission success and failure in the tested environment, resolving the most important technical uncertainty.

## Required Controls

Any production implementation derived from this decision must retain:

1. Trusted destination configuration outside the public Request and Form Schema.
2. Strict top-level and answer-field allowlists.
3. Server-side Form ID and Schema version checks.
4. Server-generated received time.
5. Field and total Payload limits.
6. Spreadsheet Formula Injection protection.
7. Safe public errors without Stack traces or Google resource details.
8. A stable `submissionId` and documented retry/duplicate behavior.
9. Locking or an equivalent concurrency control around duplicate detection and writes.
10. Explicit disclosure that the public Endpoint URL is not a Secret.

## Limitations and Consequences

### Positive

- No project-owned response database or server is required.
- Creator Credentials stay in the creator-controlled Google execution environment.
- Responses are immediately available in the creator's Spreadsheet.
- The implementation fits Static Hosting.

### Negative

- The creator must currently create, authorize and deploy an Apps Script Project manually.
- The public Endpoint can be called outside the intended Form page.
- The current PoC has no CAPTCHA or robust distributed Rate limiting.
- Availability and capacity depend on Apps Script and Google Sheets quotas.
- Sheet-based duplicate lookup will not scale indefinitely.
- Creator revocation, deleted Sheets and changed deployment permissions can break submission.
- Cross-origin behavior has only been reported for Chrome with a localhost origin.

## Release Conditions

Before production release, the project must:

- Repeat submission tests from the selected production Static Hosting origin.
- Test every officially supported browser.
- Capture sanitized Network and Apps Script execution evidence.
- Document retry UX for indeterminate network failures.
- Establish expected response volume and compare it with current Google quotas.
- Decide whether CAPTCHA, rate limiting or another abuse-control mechanism is required.
- Define creator setup, update, revocation and recovery instructions.

## Alternatives Considered

### Project-owned Backend

Rejected for MVP because it conflicts with the current Static-first and no-project-backend product constraints.

### Exposing Creator OAuth Credential to the Public Client

Rejected because it violates the security requirements and would give anonymous clients access to creator authority.

### Requiring Every Respondent to Sign In

Rejected because public anonymous response submission is an MVP requirement.

### Other User-owned Execution or Storage Services

Not selected for the first implementation. They remain fallback options if Apps Script limitations become unacceptable.

## Follow-up Decisions

- Define how Apps Script configuration and deployment can be automated or guided.
- Define production abuse protection.
- Replace Sheet scanning with an appropriate idempotency strategy if scale requires it.
- Revisit this ADR if production-origin or multi-browser validation fails.
