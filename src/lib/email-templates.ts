const publicOrigin = "https://privsentinel.vercel.app";
const defaultLogoUrl = `${publicOrigin}/privsentinel-icon-192.png`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function emailLogoUrl(logoUrl?: string) {
  const candidate = logoUrl?.trim() || defaultLogoUrl;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    return defaultLogoUrl;
  }
  if (parsedUrl.protocol !== "https:") return defaultLogoUrl;

  if (parsedUrl.hostname === "res.cloudinary.com" && parsedUrl.pathname.includes("/image/upload/")) {
    const uploadMarker = "/image/upload/";
    const uploadIndex = parsedUrl.pathname.indexOf(uploadMarker);
    const beforeUpload = parsedUrl.pathname.slice(0, uploadIndex + uploadMarker.length);
    const afterUpload = parsedUrl.pathname.slice(uploadIndex + uploadMarker.length);
    if (!afterUpload.split("/").some((segment) => segment.startsWith("e_background_removal"))) {
      parsedUrl.pathname = `${beforeUpload}e_background_removal,f_png/${afterUpload}`;
    }
  }

  return parsedUrl.toString();
}

export function buildVerificationEmail(input: {
  verificationUrl: string;
  logoUrl?: string;
}) {
  const safeUrl = escapeHtml(input.verificationUrl);
  const safeLogoUrl = escapeHtml(emailLogoUrl(input.logoUrl));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Verify your PrivSentinel email</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-shell { width:100% !important; }
      .email-content { padding:24px 18px !important; }
      .footer-column { display:block !important; width:100% !important; padding:10px 0 !important; }
      .header-art { display:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eaf0fa;">
  <div style="display:none;font-size:1px;color:#eaf0fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Verify your email address to complete your PrivSentinel registration.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eaf0fa;">
    <tr><td align="center" style="padding:24px 10px;">
      <table class="email-shell" role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;border:1px solid #c9d8f3;border-radius:22px;overflow:hidden;background:#ffffff;">
        <tr><td style="padding:18px 26px;background:#06152f;background-image:linear-gradient(120deg,#06152f 0%,#08265b 62%,#06152f 100%);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td valign="middle" width="76">
              <img src="${safeLogoUrl}" width="64" height="64" alt="PrivSentinel shield and lock logo" style="display:block;width:64px;height:64px;border:0;border-radius:12px;background-color:transparent;">
            </td>
            <td valign="middle" style="padding-left:12px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:700;letter-spacing:-1px;line-height:1.1;color:#ffffff;">Priv<span style="color:#00d9f5;">Sentinel</span></div>
              <div style="padding-top:5px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;color:#c5d9fa;">Intelligent Endpoint Security &amp; Protection</div>
            </td>
            <td class="header-art" align="right" valign="middle" width="108">
              <img src="${safeLogoUrl}" width="88" height="88" alt="Glowing PrivSentinel shield protecting your account" style="display:block;width:88px;height:88px;border:0;background-color:transparent;">
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="email-content" style="padding:30px 28px 25px;background:#ffffff;background-image:linear-gradient(150deg,#ffffff 55%,#f3f8ff 100%);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding-bottom:18px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:700;line-height:1.2;color:#071b45;">Hello,</div>
              <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#102852;">Thank you for creating a <strong style="color:#064dcc;">PrivSentinel</strong> account.</p>
              <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#102852;">To complete your registration and help secure your account, please verify your email address by clicking the button below.</p>
            </td></tr>
            <tr><td align="center" style="padding:4px 0 23px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#0759dc" style="border-radius:28px;background:#0759dc;background-image:linear-gradient(100deg,#087df0,#0645c8);box-shadow:0 8px 20px rgba(0,86,210,.25);">
                <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 28px;border:1px solid #2d8dff;border-radius:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;">&#9993;&nbsp;&nbsp; Verify Your Email Address &nbsp;&rsaquo;</a>
              </td></tr></table>
            </td></tr>
            <tr><td style="padding:16px;border:1px solid #a9cbff;border-radius:13px;background:#edf5ff;background-image:linear-gradient(110deg,#eaf3ff,#f5f9ff);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td align="center" valign="middle" width="38%" style="padding:4px 12px;border-right:1px solid #84adf4;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;line-height:1.5;color:#173363;">This link will expire in one hour.</p>
                </td>
                <td align="center" valign="middle" width="62%" style="padding:8px 10px;">
                  <img src="${safeLogoUrl}" width="40" height="40" alt="Security shield" style="display:inline-block;width:40px;height:40px;vertical-align:middle;border:0;background-color:transparent;">
                  <span style="display:inline-block;max-width:190px;padding-left:8px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#102852;">Complete verification to secure your account and continue.</span>
                </td>
              </tr></table>
              <p style="margin:12px 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#35527f;">If this link expires, return to PrivSentinel and request a new verification email.</p>
            </td></tr>
            <tr><td style="padding:15px 16px 15px 18px;border:1px solid #f4d5ac;border-radius:12px;background:#fff7ec;background-image:linear-gradient(100deg,#fff3e4,#fffaf4);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td valign="middle" width="34"><span style="font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:700;color:#e88900;">&#9888;</span></td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#4b351c;">If you did not initiate this registration, you can safely disregard this email. No further action is required.</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:20px 4px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td width="54" valign="middle"><img src="${safeLogoUrl}" width="44" height="44" alt="PrivSentinel security shield" style="display:block;width:44px;height:44px;border:0;background-color:transparent;"></td>
                <td valign="middle" style="padding-left:11px;border-left:2px solid #135ce0;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;line-height:1.3;color:#0754d2;">Stay Secure. Stay Protected.</div>
                  <div style="padding-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#1c355f;">Thank you for choosing PrivSentinel.</div>
                </td>
              </tr></table>
              <p style="margin:15px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#12294e;">Best regards,<br><strong>PrivSentinel Security Team</strong><br><em style="color:#3f5577;">Intelligent Endpoint Security &amp; Protection</em></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px 14px;background:#06152f;background-image:linear-gradient(120deg,#06152f,#09285b 60%,#06152f);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td class="footer-column" valign="top" width="36%" style="padding:3px 12px 8px 0;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:11px;font-weight:700;color:#ffffff;">Website</div>
              <a href="${publicOrigin}/" style="font-size:11px;line-height:1.6;color:#17c9f3;text-decoration:none;">https://privsentinel.vercel.app/</a>
            </td>
            <td class="footer-column" valign="top" width="32%" style="padding:3px 12px 8px;border-left:1px solid #4d6386;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:11px;font-weight:700;color:#ffffff;">Support</div>
              <a href="mailto:support@privsentinel.app" style="font-size:11px;line-height:1.6;color:#17c9f3;text-decoration:none;">support@privsentinel.app</a>
            </td>
            <td class="footer-column" valign="top" width="32%" style="padding:3px 0 8px 12px;border-left:1px solid #4d6386;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:11px;font-weight:700;color:#ffffff;">Follow Us</div>
              <div style="font-size:11px;line-height:1.6;color:#c7d7f0;">No verified social links are configured.</div>
            </td>
          </tr></table>
          <p style="margin:10px 0 0;padding-top:10px;border-top:1px solid #263d63;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#d4def0;">&copy; 2026 PrivSentinel. All rights reserved.<br><em style="color:#b4c3dd;">This is an automated security notification. Please do not reply directly to this email.</em></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hello,

Thank you for creating a PrivSentinel account.

To complete your registration and help secure your account, please verify your email address by visiting this unique link:
${input.verificationUrl}

This link will expire in one hour.

If you did not initiate this registration, you can safely disregard this email. No further action is required.

Stay Secure. Stay Protected.

Thank you for choosing PrivSentinel.

Best regards,
PrivSentinel Security Team
Intelligent Endpoint Security & Protection

Website: ${publicOrigin}/
Support: support@privsentinel.app
Follow Us: No verified social links are configured.

© 2026 PrivSentinel. All rights reserved.
This is an automated security notification. Please do not reply directly to this email.`;

  return { html, text };
}

export function buildPasswordResetEmail(input: { resetUrl: string; logoUrl?: string }) {
  const safeUrl = escapeHtml(input.resetUrl);
  const safeLogoUrl = escapeHtml(emailLogoUrl(input.logoUrl));
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Reset your PrivSentinel password</title>
</head>
<body style="margin:0;padding:24px 10px;background:#eaf0fa;">
  <div style="display:none;font-size:1px;color:#eaf0fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Use your secure password reset link to restore access to your PrivSentinel account.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;border:1px solid #c9d8f3;border-radius:20px;overflow:hidden;background:#ffffff;">
    <tr><td style="padding:22px 26px;background:#06152f;background-image:linear-gradient(120deg,#06152f 0%,#08265b 62%,#06152f 100%);">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" width="76"><img src="${safeLogoUrl}" width="64" height="64" alt="PrivSentinel app logo" style="display:block;width:64px;height:64px;border:0;background-color:transparent;"></td>
        <td valign="middle" style="padding-left:12px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:700;letter-spacing:-1px;line-height:1.1;color:#ffffff;">Priv<span style="color:#00d9f5;">Sentinel</span></div>
          <div style="padding-top:5px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;color:#c5d9fa;">Intelligent Endpoint Security &amp; Protection</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:34px 30px 30px;background:#ffffff;background-image:linear-gradient(150deg,#ffffff 55%,#f3f8ff 100%);font-family:Arial,Helvetica,sans-serif;color:#102852;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;color:#0876dc;">ACCOUNT SECURITY</div>
      <h1 style="margin:10px 0 12px;font-size:28px;line-height:1.2;color:#071b45;">Reset your password</h1>
      <p style="margin:0;font-size:15px;line-height:1.65;">We received a request to reset the password for your PrivSentinel account. Use the secure button below to choose a new password.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 23px;"><tr><td align="center" bgcolor="#0759dc" style="border-radius:28px;background:#0759dc;background-image:linear-gradient(100deg,#087df0,#0645c8);">
        <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 28px;border:1px solid #2d8dff;border-radius:28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Reset my password</a>
      </td></tr></table>
      <p style="margin:0;padding:14px 16px;border:1px solid #c9d8f3;border-radius:10px;background:#f2f7ff;font-size:13px;line-height:1.6;color:#294a7c;">For your security, this link is personal and time-limited. If you did not request a password reset, you can safely ignore this email; your password will not change.</p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:#12294e;">Stay Secure. Stay Protected.<br><strong>PrivSentinel Security Team</strong></p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#06152f;background-image:linear-gradient(120deg,#06152f,#09285b 60%,#06152f);font-family:Arial,Helvetica,sans-serif;text-align:center;">
      <a href="${publicOrigin}/" style="font-size:11px;line-height:1.6;color:#17c9f3;text-decoration:none;">privsentinel.vercel.app</a>
      <p style="margin:9px 0 0;padding-top:9px;border-top:1px solid #263d63;font-size:11px;line-height:1.6;color:#d4def0;">&copy; 2026 PrivSentinel. This is an automated security notification.</p>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `We received a request to reset the password for your PrivSentinel account.

Reset your password using this secure link:
${input.resetUrl}

If you did not request a password reset, you can safely ignore this email; your password will not change.

Stay Secure. Stay Protected.
PrivSentinel Security Team
${publicOrigin}/`;

  return { html, text };
}
