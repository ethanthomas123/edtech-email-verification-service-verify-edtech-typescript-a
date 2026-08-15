import assert from "node:assert/strict";
import test from "node:test";
import { beginVerifiedEnrollment, parseSignupBody } from "../src/verification_enrollment.js";

test("holds course delivery and educator activation until email verification", async () => {
  let sent: Parameters<Parameters<typeof beginVerifiedEnrollment>[1]>[0] | undefined;
  const input = parseSignupBody({
    learner_email: "learner@example.edu",
    learner_name: "Mina <Student>",
    course_id: "geometry-101",
    course_title: "Geometry 101",
    deadline_at: "2026-09-01T12:00:00.000Z",
  });

  const result = await beginVerifiedEnrollment(
    input,
    async (email) => {
      sent = email;
      return { message_id: "message-42" };
    },
    {
      appBaseUrl: "https://learn.example.edu",
      now: () => new Date("2026-08-15T12:00:00.000Z"),
      token: () => "fixed-token",
    },
  );

  assert.equal(result.course.delivery, "held_until_email_verified");
  assert.deepEqual(result.educator_report, {
    status: "pending_email_verification",
    counts_as_active: false,
  });
  assert.equal(result.verification.expires_at, "2026-08-16T12:00:00.000Z");
  assert.equal(result.message_id, "message-42");
  assert.match(sent?.html ?? "", /https:\/\/learn\.example\.edu\/verify-email\?token=fixed-token/);
  assert.match(sent?.html ?? "", /Mina &lt;Student&gt;/);
  assert.match(sent?.idempotencyKey ?? "", /^enrollment-verification-/);
});
