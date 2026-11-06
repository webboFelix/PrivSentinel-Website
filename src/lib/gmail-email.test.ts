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

  it("falls back to required STARTTLS when the implicit-TLS connection cannot be established", async () => {
    const firstError = Object.assign(new Error("connect timeout"), {
      code: "ETIMEDOUT",
      command: "CONN",
    });
    const firstSendMail = vi.fn().mockRejectedValue(firstError);
    const secondSendMail = vi.fn().mockResolvedValue({});
    createTransport
      .mockReturnValueOnce({ sendMail: firstSendMail, close })
      .mockReturnValueOnce({ sendMail: secondSendMail, close });

    await sendGmailEmail(input);

    expect(createTransport).toHaveBeenNthCalledWith(1, expect.objectContaining({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
    }));
    expect(createTransport).toHaveBeenNthCalledWith(2, expect.objectContaining({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
    }));
    expect(secondSendMail).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("preserves both connection errors if both Gmail SMTP ports fail", async () => {
    const firstError = Object.assign(new Error("connection timeout"), {
      code: "ETIMEDOUT",
      command: "CONN",
    });
    const secondError = Object.assign(new Error("connection refused"), {
      code: "ECONNECTION",
      command: "CONN",
    });
    createTransport
      .mockReturnValueOnce({ sendMail: vi.fn().mockRejectedValue(firstError), close })
      .mockReturnValueOnce({ sendMail: vi.fn().mockRejectedValue(secondError), close });

    const send = sendGmailEmail(input);
    await expect(send).rejects.toThrow("Could not send email-verification email.");
    await expect(send).rejects.toMatchObject({
      cause: expect.objectContaining({
        errors: [firstError, secondError],
      }),
    });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("returns actionable authentication errors without logging", async () => {
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

    expect(log).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
});
