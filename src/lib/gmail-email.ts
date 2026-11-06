import nodemailer from "nodemailer";

type GmailEmailInput = {
  user: string;
  appPassword: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  operation: "password-reset" | "email-verification" | "security-notice" | "contact-notification" | "contact-response";
};

const connectionErrorCodes = new Set([
  "ECONNECTION",
  "EDNS",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ESOCKET",
  "ETIMEDOUT",
]);

function isConnectionSetupError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  return "command" in error
    && error.command === "CONN"
    && "code" in error
    && typeof error.code === "string"
    && connectionErrorCodes.has(error.code);
}

function classifySmtpError(error: unknown) {
  const smtpError = typeof error === "object" && error !== null ? error : {};
  const code = "code" in smtpError && typeof smtpError.code === "string" ? smtpError.code : "UNKNOWN";
  const responseCode = "responseCode" in smtpError && typeof smtpError.responseCode === "number"
    ? smtpError.responseCode
    : null;

  if (code === "EAUTH" || responseCode === 534 || responseCode === 535) {
    return {
      code,
      responseCode,
      category: "authentication",
      message: "Gmail rejected SMTP authentication. Confirm 2-Step Verification is enabled and GMAIL_APP_PASSWORD is a current app password for GMAIL_SMTP_USER.",
    };
  }
  if (connectionErrorCodes.has(code)) {
    return {
      code,
      responseCode,
      category: "connection",
      message: "Could not connect to Gmail SMTP. Check that the server permits outbound SMTP on ports 465 and 587, then try again.",
    };
  }
  if (responseCode === 421 || responseCode === 450 || responseCode === 451 || responseCode === 454) {
    return {
      code,
      responseCode,
      category: "temporary_rejection",
      message: "Gmail temporarily rejected this email. Wait a few minutes before trying again.",
    };
  }
  return {
    code,
    responseCode,
    category: "smtp_rejection",
    message: "Gmail SMTP rejected this email. Check the Gmail account's sending limits and retry later.",
  };
}

export async function sendGmailEmail(input: GmailEmailInput) {
  let connectionError: unknown;
  for (const [index, port] of [465, 587].entries()) {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port,
      secure: port === 465,
      ...(port === 587 ? { requireTLS: true } : {}),
      auth: {
        user: input.user,
        pass: input.appPassword.replace(/\s+/g, ""),
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    try {
      await transporter.sendMail({
        from: { name: "PrivSentinel", address: input.user },
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      });
      return;
    } catch (error) {
      if (index === 0 && isConnectionSetupError(error)) {
        connectionError = error;
      } else {
        const failure = classifySmtpError(error);
        const cause = connectionError
          ? new AggregateError([connectionError, error], "Both Gmail SMTP connection methods failed.")
          : error;
        throw new Error(`Could not send ${input.operation} email. ${failure.message}`, { cause });
      }
    } finally {
      transporter.close();
    }
  }

  throw new Error(`Could not send ${input.operation} email. Gmail SMTP connection failed.`);
}
