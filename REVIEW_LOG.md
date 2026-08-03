# Review and maturity log

## Decision record

Expert's framework was treated as a proposal, not automatic approval.

| Proposal | Decision | Rationale / implemented boundary | Maturity |
|---|---|---|---|
| Visible six-factor breakdown | Accepted, modified | Six normalized factors, weights, raw explanations, and cost/day are shown. The 0–100 fit score remains only as a compact roll-up, not objective truth. | Declared; deterministic/browser tested |
| Minimum viable + comfortable stay | Accepted | Both are reported; “comfortable” adds an explicit recovery/pace buffer rather than a second opaque model. | Declared; synthetic tested |
| One variable most likely to flip the decision | Accepted, modified | Uses a deterministic priority: budget overrun, then minimum-stay gap, then comfort gap, then weakest factor. | Declared; synthetic tested |
| Explicit units and currency | Accepted | Hours/days/nights are in labels; seven currency units are supported. Currency changes display units only—no exchange conversion is claimed. Invalid inputs are surfaced rather than silently trusted. | Browser tested |
| Trip purpose | Accepted, modified | Leisure, fixed event, and visiting people are explicit. Important fixed events may override a marginal efficiency verdict; all burdens remain visible. | Declared; synthetic tested |
| Shareable result URL | Accepted | Scenario inputs are encoded in the URL; no account/backend required. | Browser tested |
| “Was this right?” feedback | Accepted as instrumentation only | v0.1 stores the latest answer locally. It is not represented as collected evidence or a production analytics pipeline. | Declared, not real-user-proven |
| Heuristic v0.1 label | Accepted | The UI and README disclose weights, assumptions, and lack of real-world calibration. | Declared |
| Three SEO query pages | Deferred | Building pages before query/user evidence would confuse publishing with distribution. | Not started |
| Affiliate CTAs | Deferred | Add only after observed result-CTA intent and with disclosure. | Not started |

## Evidence ledger

| Evidence | Result | Maturity impact |
|---|---|---|
| Baseline pre-change suite (`node test.js`) | PASS, 5 scenarios | Baseline only |
| Updated deterministic suite (`node test.js`) | PASS, 11 cases/invariants | Current implementation evidence |
| Desktop/mobile browser exercise (`python3 browser_test.py`) | PASS; URL hydration, currency rerender, local feedback, fail-closed invalid input, responsive overflow, six-factor DOM, zero captured console errors | Current browser-path evidence |
| Independent formula/UX red-team | Completed against moving pre-implementation snapshot; recommendations treated as critique, not approval | Review evidence only |
| Independent 10 blinded scenarios — v1 | FAIL, 7/10: JPY cap, low-desire calibration, and invalid-result fail-closed defects | Did not clear tested gate; receipt preserved in `blinded-scenario-receipt.json` |
| Corrective deterministic/browser suite | PASS, 11 cases/invariants plus browser fail-closed path | Current implementation evidence |
| Independent exact-current blinded recheck — v2 | **PASS, 10/10**; all three v1 defects closed; exact-byte bound to `app.js` and `index.html` | Clears the synthetic **tested** gate; receipt: `blinded-scenario-receipt-v2.json` |
| Real traveler decisions and post-trip outcomes | None | **Not real-user-proven** |

## Release boundary

This is a verified local preview, not a public deployment. No external publishing, analytics collection, affiliate enrollment, or spend occurred.

Current maturity: **tested**, not **real-user-proven**.
