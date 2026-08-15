import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, verificationEmailSender } from "./infrai_email.js";
import {
  beginVerifiedEnrollment,
  EnrollmentDecisionError,
  parseSignupBody,
} from "./verification_enrollment.js";

const apiKey = process.env.INFRAI_API_KEY ?? "";
const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const port = Number(process.env.PORT ?? 3000);
const sendEmail = verificationEmailSender(apiKey);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/signup") {
    return json(response, 404, { error: "Route not found" });
  }

  try {
    const body = parseSignupBody(await readJson(request));
    const enrollment = await beginVerifiedEnrollment(body, sendEmail, { appBaseUrl });
    return json(response, 202, enrollment);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(response, 400, { error: "Invalid signup body", issues: error.issues });
    }
    if (error instanceof EnrollmentDecisionError) {
      return json(response, 422, { error: error.message });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.message });
    }
    return json(response, 500, { error: "Unable to begin enrollment" });
  }
});

server.listen(port, () => {
  console.log(`Signup service listening on http://localhost:${port}`);
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
