import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const signupBodySchema = z.object({
  learner_email: z.string().email(),
  learner_name: z.string().trim().min(1).max(80),
  course_id: z.string().trim().min(1).max(80),
  course_title: z.string().trim().min(1).max(160),
  deadline_at: z.string().datetime({ offset: true }),
});

export type SignupBody = z.infer<typeof signupBodySchema>;

export type EmailSendResult = { message_id: string };
export type SendVerificationEmail = (input: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}) => Promise<EmailSendResult>;

export type PendingEnrollment = {
  enrollment_id: string;
  learner_email: string;
  course: { id: string; title: string; delivery: "held_until_email_verified" };
  learner_deadline_at: string;
  educator_report: { status: "pending_email_verification"; counts_as_active: false };
  verification: { status: "pending"; expires_at: string };
  message_id: string;
};

type Clock = () => Date;
type TokenFactory = () => string;

export function parseSignupBody(value: unknown): SignupBody {
  return signupBodySchema.parse(value);
}

export async function beginVerifiedEnrollment(
  input: SignupBody,
  sendEmail: SendVerificationEmail,
  options: { appBaseUrl: string; now?: Clock; token?: TokenFactory },
): Promise<PendingEnrollment> {
  const now = options.now?.() ?? new Date();
  const deadline = new Date(input.deadline_at);
  if (deadline <= now) {
    throw new EnrollmentDecisionError("deadline_at must be in the future");
  }

  const token = options.token?.() ?? randomBytes(24).toString("hex");
  const enrollmentId = createHash("sha256")
    .update(`${input.course_id}:${input.learner_email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 20);
  const expiresAt = new Date(Math.min(deadline.getTime(), now.getTime() + 24 * 60 * 60 * 1000));
  const link = new URL("/verify-email", options.appBaseUrl);
  link.searchParams.set("token", token);

  const delivery = await sendEmail({
    to: input.learner_email,
    subject: `Verify your email for ${input.course_title}`,
    html: `<p>Hello ${escapeHtml(input.learner_name)},</p><p>Verify your email to open <strong>${escapeHtml(input.course_title)}</strong>.</p><p><a href="${link.toString()}">Verify email</a></p><p>Your course deadline is ${escapeHtml(input.deadline_at)}.</p>`,
    idempotencyKey: `enrollment-verification-${enrollmentId}`,
  });

  return {
    enrollment_id: enrollmentId,
    learner_email: input.learner_email,
    course: { id: input.course_id, title: input.course_title, delivery: "held_until_email_verified" },
    learner_deadline_at: input.deadline_at,
    educator_report: { status: "pending_email_verification", counts_as_active: false },
    verification: { status: "pending", expires_at: expiresAt.toISOString() },
    message_id: delivery.message_id,
  };
}

export class EnrollmentDecisionError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
