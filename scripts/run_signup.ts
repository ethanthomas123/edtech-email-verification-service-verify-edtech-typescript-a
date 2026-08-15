import { beginVerifiedEnrollment, parseSignupBody } from "../src/verification_enrollment.js";
import { verificationEmailSender } from "../src/infrai_email.js";

const apiKey = process.env.INFRAI_API_KEY ?? "";
const learnerEmail = process.env.LEARNER_EMAIL;
if (!learnerEmail) throw new Error("LEARNER_EMAIL is required");

const input = parseSignupBody({
  learner_email: learnerEmail,
  learner_name: "Amina",
  course_id: "algebra-foundations",
  course_title: "Algebra Foundations",
  deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});
const result = await beginVerifiedEnrollment(input, verificationEmailSender(apiKey), {
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
});
console.log(JSON.stringify(result, null, 2));
