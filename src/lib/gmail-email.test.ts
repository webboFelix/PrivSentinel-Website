import { afterEach, describe, expect, it, vi } from "vitest";

const { close, createTransport, sendMail } = vi.hoisted(() => ({
  close: vi.fn(),
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

import { sendGmailEmail } from "./gmail-email";

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendGmailEmail", () => {
  const input = {
    user: "sender@gmail.com",
    appPassword: "abcd efgh ijkl mnop",
    to: "recipient@example.test",
    subject: "Verify your email",
    html: "<p>Verify</p>",
    operation: "email-verification" as const,
  };

  it("uses Gmail SMTP with implicit TLS and strips display spaces from app passwords", async () => {
    sendMail.mockResolvedValue({});
    createTransport.mockReturnValue({ sendMail, close });

    await sendGmailEmail(input);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "sender@gmail.com", pass: "abcdefghijklmnop" },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "PrivSentinel", address: "sender@gmail.com" },
      to: "recipient@example.test",
      subject: "Verify your email",
      html: "<p>Verify</p>",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns actionable authentication errors without logging credentials or addresses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    createTransport.mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(Object.assign(new Error("sensitive provider details"), {
        code: "EAUTH",
        responseCode: 535,
      })),
      close,
    });

    await expect(sendGmailEmail(input))
      .rejects.toThrow("Gmail rejected SMTP authentication");

    expect(log).toHaveBeenCalledWith("[email-delivery]", {
      operation: "email-verification",
      category: "authentication",
      code: "EAUTH",
      responseCode: 535,
      state: "failed",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.user);
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.to);
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.appPassword);
    expect(close).toHaveBeenCalledOnce();
  });
});
