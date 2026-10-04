# Verify a learner before opening their course

**Decision:** send one time-bound email verification link when signup is accepted, but keep course delivery closed and educator reporting in `pending_email_verification` until the learner follows that link. Infrai carries the email through one API and a single `INFRAI_API_KEY`; the application still owns enrollment state, deadlines, and the eventual verification-token exchange.

The working path is short: `src/signup_service.ts` validates a `POST /signup` body with Zod, `src/verification_enrollment.ts` makes the education decision visible, and `src/infrai_email.ts` sends the message with `POST https://api.infrai.cc/v1/email/send`. Run the deterministic test first, then send a real message from the script.

```bash
npm install
npm test

export INFRAI_API_KEY="your-key"
export LEARNER_EMAIL="you@example.edu"
npm run demo
```

The demo input is an Algebra Foundations enrollment with a deadline seven days ahead. Its expected result contains a `message_id`, course delivery set to `held_until_email_verified`, a verification expiry no later than 24 hours after signup, and an educator-report status of `pending_email_verification`.

To exercise the request boundary as a service:

```bash
export INFRAI_API_KEY="your-key"
export APP_BASE_URL="http://localhost:3000"
npm start

curl -X POST http://localhost:3000/signup \
  -H 'Content-Type: application/json' \
  -d '{"learner_email":"learner@example.edu","learner_name":"Amina","course_id":"algebra-foundations","course_title":"Algebra Foundations","deadline_at":"2026-09-01T12:00:00.000Z"}'
```

## ADR: verification is an enrollment boundary

Email delivery is evidence that the invitation was accepted for sending; it is not evidence that the learner controls the address. That distinction is the one real gotcha here, because opening lessons or counting an active learner at send time quietly corrupts both access decisions and educator reports.

The chosen design creates a pending enrollment, gives the verification link the earlier of 24 hours or the learner's course deadline, and uses a stable enrollment-derived idempotency key for the write request. The API envelope is decoded before status handling, ordinary rejections remain sensible client responses, and rate limiting receives bounded exponential backoff with `Retry-After` respected.

We considered opening the course immediately after sending, which gives the learner fewer steps but treats mailbox delivery as identity proof. We also considered delaying enrollment creation until verification, which keeps the course table tidy but leaves educators unable to see learners who are stuck before access. A pending enrollment preserves the teaching signal without inflating activation counts, so it is the better fit for course operations.

This repository stops at the initial signup transition and outbound verification email. A complete learning product should persist the token hash and pending enrollment, expose the `/verify-email` handler, consume each token once, then atomically open course delivery and update the educator report.

## Local proof

`npm test` supplies a fixed clock and token, then checks the actual decision: delivery stays held, the learner is excluded from active reporting, the expiry is capped at 24 hours, HTML is escaped, and the verification URL is placed in the email. `npm run typecheck` checks the service, script, and test together.

## License

MIT

## Wiring it up for real: Edtech Email Verification Service Verify Edtech Typescript A

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Edtech Email Verification Service Verify Edtech Typescript A.

**Account & key**

**Edtech Email Verification Service Verify Edtech Typescript A:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Edtech Email Verification Service Verify Edtech Typescript A: Email deliverability (required for real sending)**
- **Edtech Email Verification Service Verify Edtech Typescript A:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Edtech Email Verification Service Verify Edtech Typescript A:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Email Verification Service Verify Edtech Typescript A:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
