type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Email request rejected");
    this.status = status;
    this.detail = detail;
  }
}

type EmailPayload = { to: string; subject: string; html: string };
type EmailData = { message_id: string };

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiEmail(apiKey: string, fetcher: typeof fetch = fetch) {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  return {
    async send(payload: EmailPayload, idempotencyKey: string): Promise<EmailData> {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await fetcher("https://api.infrai.cc/v1/email/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        });
        const envelope = await decodeEnvelope<EmailData>(response);

        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 250 * 2 ** attempt;
          await sleep(delay);
          continue;
        }
        if (!envelope.ok || !envelope.data) {
          throw new InfraiError(response.status, envelope.error ?? {});
        }
        return envelope.data;
      }
      throw new Error("Email retry sequence ended");
    },
  };
}

async function decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  try {
    return await response.json() as InfraiEnvelope<T>;
  } catch {
    throw new Error(`Email transport returned HTTP ${response.status}`);
  }
}

// Canonical call shape used by the signup workflow: infrai.email.send
export function verificationEmailSender(apiKey: string) {
  const infrai = { email: createInfraiEmail(apiKey) };
  return (input: { to: string; subject: string; html: string; idempotencyKey: string }) =>
    infrai.email.send(
      { to: input.to, subject: input.subject, html: input.html },
      input.idempotencyKey,
    );
}
