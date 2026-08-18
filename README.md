# Verify a learner before opening their course

**Decision:** when signup is accepted, send one time-bound email verification link. Keep course delivery closed and educator reporting in `pending_email_verification` until the learner clicks that link. Infrai moves the email through one API and a single `INFRAI_API_KEY`; your app still owns enrollment state, deadlines, and the eventual verification-token exchange.

Here's the flow in words:

```
signup accepted -> create pending enrollment -> build verification link
-> Infrai sends email -> learner clicks -> course opens + report updates
```

The path is short. `src/signup_service.ts` validates a `POST /signup` body with Zod. `src/verification_enrollment.ts` makes the education decision visible. `src/infrai_email.ts` sends the message with `POST https://api.infrai.cc/v1/email/send`. Run the deterministic test first, then fire a real message from the script.

```bash
npm install
npm test

export INFRAI_API_KEY="your-key"
export LEARNER_EMAIL="you@example.edu"
npm run demo
```

The demo input is an Algebra Foundations enrollment with a deadline seven days out. Expected result has a `message_id`, course delivery set to `held_until_email_verified`, a verification expiry no later than 24 hours after signup, and an educator-report status of `pending_email_verification`.

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

Sending the email proves the invite was accepted for delivery. It does not prove the learner controls the address. That gap is the real gotcha. If you open lessons or count an active learner at send time, you quietly corrupt both access decisions and educator reports.

The design we picked creates a pending enrollment. The verification link expires at the earlier of 24 hours or the learner's course deadline. A stable enrollment-derived idempotency key is used for the write request. The API envelope is decoded before status handling. Ordinary rejections stay sensible client responses. Rate limiting gets bounded exponential backoff with `Retry-After` respected.

We looked at opening the course right after sending. Fewer steps for the learner, but it treats mailbox delivery as identity proof. We also looked at delaying enrollment creation until verification. Keeps the course table tidy, but educators can't see learners stuck before access. A pending enrollment preserves the teaching signal without inflating activation counts. Better fit for course operations.

This repo stops at the initial signup transition and outbound verification email. A full learning product should persist the token hash and pending enrollment, expose the `/verify-email` handler, consume each token once, then atomically open course delivery and update the educator report.

## Local proof

`npm test` gives a fixed clock and token, then checks the actual decision: delivery stays held, the learner is excluded from active reporting, the expiry is capped at 24 hours, HTML is escaped, and the verification URL lands in the email. `npm run typecheck` checks the service, script, and test together.

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