import { describe, expect, it } from "vitest";
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
} from "./email-templates";

describe("verification email template", () => {
  it("renders the one-hour expiry message, unique link, and accessible branded content", () => {
    const verificationUrl = "https://privsentinel.vercel.app/verify-email?token=unique-token&callbackURL=%2F";
    const { html, text } = buildVerificationEmail({
      verificationUrl,
    });

    expect(html).toContain("This link will expire in one hour.");
    expect(text).toContain("This link will expire in one hour.");
    expect(html).not.toContain("countdown");
    expect(html).not.toContain("expires at (UTC)");
    expect(html).not.toContain("does not update in your inbox");
    expect(html).toContain("href=\"https://privsentinel.vercel.app/verify-email?token=unique-token&amp;callbackURL=%2F\"");
    expect(html).toContain("src=\"https://privsentinel.vercel.app/privsentinel-icon-192.png\"");
    expect(html).toContain("alt=\"PrivSentinel shield and lock logo\"");
    expect(html).not.toContain("<script");
    expect(html.match(/<img\b[^>]*\bsrc="[^"]+"/g)?.every((image) => !image.includes("unique-token"))).toBe(true);
    expect(text).toContain(verificationUrl);
  });

  it("uses a transparent Cloudinary logo for branded email", () => {
    const { html } = buildVerificationEmail({
      verificationUrl: "https://privsentinel.vercel.app/verify-email?token=token",
      logoUrl: "https://res.cloudinary.com/webbodev/image/upload/v1793940468/PrivSentinel_pewnir.png",
    });

    expect(html).toContain(
      'src="https://res.cloudinary.com/webbodev/image/upload/e_background_removal,f_png/v1793940468/PrivSentinel_pewnir.png"',
    );
    expect(html).toContain("background-color:transparent");
  });
});

describe("password reset email template", () => {
  it("renders a branded reset link in accessible HTML and plain text", () => {
    const resetUrl = "https://privsentinel.vercel.app/reset-password?token=unique-token&callbackURL=%2F";
    const { html, text } = buildPasswordResetEmail({
      resetUrl,
      logoUrl: "https://res.cloudinary.com/webbodev/image/upload/v1793940468/PrivSentinel_pewnir.png",
    });

    expect(html).toContain('href="https://privsentinel.vercel.app/reset-password?token=unique-token&amp;callbackURL=%2F"');
    expect(html).toContain("Reset my password");
    expect(html).toContain("e_background_removal,f_png");
    expect(html).toContain("If you did not request a password reset");
    expect(text).toContain(resetUrl);
    expect(html).not.toContain("<script");
  });
});
