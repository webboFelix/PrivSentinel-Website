import nodemailer from "nodemailer";

type GmailEmailInput = {
  user: string;
  appPassword: string;
  to: string;
  subject: string;
  html: string;
  operation: "password-reset" | "email-verification";
};

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
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET" || code === "EDNS") {
    return {
      code,
      responseCode,
      category: "connection",
      message: "Could not connect securely to Gmail SMTP. Check the network and try again.",
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
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
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
    });
  } catch (error) {
    const failure = classifySmtpError(error);
    throw new Error(failure.message);
  } finally {
    transporter.close();
  }
}
