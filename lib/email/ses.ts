import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createHmac } from "node:crypto";

const PARKGRADER_LOGO = "https://assets.buckysolutions.com/parkgrader%2Blogo%2Balternate.png";

const esc = (v: string) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function getSESClient(): SESv2Client {
  return new SESv2Client({
    region: process.env.SES_AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function fromAddress(): string {
  if (process.env.SES_FROM_NAME && process.env.SES_FROM_EMAIL) {
    return `${process.env.SES_FROM_NAME} <${process.env.SES_FROM_EMAIL}>`;
  }
  return process.env.SES_FROM_EMAIL ?? "ParkGrader Monitoring <alerts@parkgrader.com>";
}

// ── Unsubscribe tokens ──────────────────────────────────────────────

function getUnsubscribeToken(email: string): string {
  const secret = process.env.MONITORING_SECRET ?? "fallback-secret";
  const hmac = createHmac("sha256", secret);
  hmac.update(email.toLowerCase().trim());
  return hmac.digest("hex").slice(0, 32);
}

function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = getUnsubscribeToken(email);
  return token === expected;
}

export { verifyUnsubscribeToken };

// ── Shared email footer with unsubscribe ────────────────────────────

function emailFooter(email: string): string {
  const token = getUnsubscribeToken(email);
  const baseUrl = process.env.APP_BASE_URL ?? "https://parkgrader.com";
  return `
                <!-- Footer -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-inner" style="max-width: 600px; margin: 0 auto;">
                    <tr>
                        <td align="center" style="padding: 15px 0 0 0; color: #999999; font-size: 12px;">
                            &copy; ${new Date().getFullYear()} Bucky Solutions LLC &middot; All Rights Reserved
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 8px 0 0 0;">
                            <a href="${esc(baseUrl)}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}" style="color: #999999; font-size: 11px; text-decoration: underline;">
                                Unsubscribe from monitoring alerts
                            </a>
                        </td>
                    </tr>
                </table>`;
}

// ── Monitoring Alert Email ──────────────────────────────────────────

function buildAlertHtml(params: {
  websiteName: string;
  incidentType: string;
  incidentMessage: string;
  incidentTime: string;
  websiteUrl?: string;
  email: string;
}): string {
  const label = params.incidentType.replace(/_/g, " ");
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>ParkGrader Alert — ${esc(params.websiteName)}</title>
    <style>
        @media only screen and (max-width: 480px) {
            .email-inner   { width: 100% !important; }
            .email-padding { padding: 30px 20px !important; }
            .email-logo    { margin-bottom: 28px !important; }
            .email-btn-td  { padding: 16px 0 !important; }
        }
        @media only screen and (max-width: 375px) {
            .email-padding { padding: 24px 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F0F0EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: #F0F0EE; padding: 24px 20px;">
        <tr>
            <td align="center" valign="top">

                <!-- Main card -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-inner" style="max-width: 600px; background-color: #FEFDFA; border-radius: 12px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <tr>
                        <td class="email-padding" style="padding: 40px 40px 30px 40px;">

                            <img src="${PARKGRADER_LOGO}" alt="ParkGrader" width="180" class="email-logo" style="display: block; max-width: 180px; width: 100%; height: auto; margin-bottom: 40px; border: 0;">

                            <p style="color: #888888; font-size: 16px; line-height: 24px; margin: 0 0 6px 0;">
                                Monitoring Alert
                            </p>
                            <p style="color: #000000; font-size: 22px; font-weight: bold; line-height: 28px; margin: 0 0 30px 0;">
                                ${esc(params.websiteName)}
                            </p>

                            <!-- Issue info -->
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0;">
                                <span style="color: #888888;">Issue:</span> <span style="color: #000000;">${esc(displayLabel)}</span>
                            </p>
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0;">
                                <span style="color: #888888;">Details:</span> <span style="color: #000000;">${esc(params.incidentMessage)}</span>
                            </p>
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                                <span style="color: #888888;">Detected:</span> <span style="color: #000000;">${esc(params.incidentTime)}</span>
                            </p>

                            <!-- Divider -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin: 0 0 30px 0;">
                                <tr><td style="border-top: 1px solid #EAEAEA; font-size: 1px; line-height: 1px;">&nbsp;</td></tr>
                            </table>

                            <p style="color: #888888; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; line-height: 20px; margin: 0 0 12px 0;">
                                What this means
                            </p>
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0; color: #000000;">
                                ParkGrader detected an issue with your website that may affect your visitors. We recommend checking your website to make sure everything is running smoothly.
                            </p>

                            <!-- Buttons -->
                            ${params.websiteUrl
                              ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                    <tr>
                                        <td align="center" class="email-btn-td" style="border-radius: 12px; background-color: #2da4a9;">
                                            <a href="${esc(params.websiteUrl)}" style="display: block; width: 100%; padding: 18px 0; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 12px;">
                                                Check your website
                                            </a>
                                        </td>
                                    </tr>
                                </table>`
                              : ""
                            }

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 14px;">
                                <tr>
                                    <td align="center" class="email-btn-td" style="border-radius: 12px; border: 1px solid #2da4a9;">
                                        <a href="mailto:help@buckysolutions.com" style="display: block; width: 100%; padding: 18px 0; color: #2da4a9; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 12px;">
                                            Contact support
                                        </a>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>
                </table>

                ${emailFooter(params.email)}

            </td>
        </tr>
    </table>

</body>
</html>`;
}

// ── Welcome Email ───────────────────────────────────────────────────

function buildWelcomeHtml(params: {
  websiteName: string;
  websiteUrl: string;
  email: string;
  reportUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>Monitoring Active — ${esc(params.websiteName)}</title>
    <style>
        @media only screen and (max-width: 480px) {
            .email-inner   { width: 100% !important; }
            .email-padding { padding: 30px 20px !important; }
            .email-logo    { margin-bottom: 28px !important; }
            .email-btn-td  { padding: 16px 0 !important; }
        }
        @media only screen and (max-width: 375px) {
            .email-padding { padding: 24px 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F0F0EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: #F0F0EE; padding: 24px 20px;">
        <tr>
            <td align="center" valign="top">

                <!-- Main card -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-inner" style="max-width: 600px; background-color: #FEFDFA; border-radius: 12px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <tr>
                        <td class="email-padding" style="padding: 40px 40px 30px 40px;">

                            <img src="${PARKGRADER_LOGO}" alt="ParkGrader" width="180" class="email-logo" style="display: block; max-width: 180px; width: 100%; height: auto; margin-bottom: 40px; border: 0;">

                            <p style="color: #888888; font-size: 16px; line-height: 24px; margin: 0 0 6px 0;">
                                Your website report is ready
                            </p>
                            <p style="color: #000000; font-size: 22px; font-weight: bold; line-height: 28px; margin: 0 0 30px 0;">
                                ${esc(params.websiteName)}
                            </p>

                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0; color: #000000;">
                                Thanks for running your free ParkGrader audit. We scanned your website and found areas that may be affecting your bookings.
                            </p>

                            ${params.reportUrl
                              ? `<p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0; color: #000000;">
                                    <a href="${esc(params.reportUrl)}" style="color: #2da4a9; font-weight: 600;">View your full report here</a> to see your score and the specific fixes we recommend.
                                </p>`
                              : ""
                            }

                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0; color: #000000;">
                                We&rsquo;ll also send you a personalized video overview walking through your results. This can take us a little time to prepare — we&rsquo;ll email you as soon as it&rsquo;s ready.
                            </p>

                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0; color: #000000;">
                                In the meantime, we&rsquo;ll keep an eye on your website and let you know if anything needs attention.
                            </p>

                            <!-- Divider -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin: 0 0 30px 0;">
                                <tr><td style="border-top: 1px solid #EAEAEA; font-size: 1px; line-height: 1px;">&nbsp;</td></tr>
                            </table>

                            ${params.reportUrl
                              ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                    <tr>
                                        <td align="center" class="email-btn-td" style="border-radius: 12px; background-color: #2da4a9;">
                                            <a href="${esc(params.reportUrl)}" style="display: block; width: 100%; padding: 18px 0; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 12px;">
                                                View your report
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 14px;">
                                    <tr>
                                        <td align="center" class="email-btn-td" style="border-radius: 12px; border: 1px solid #2da4a9;">
                                            <a href="mailto:help@buckysolutions.com" style="display: block; width: 100%; padding: 18px 0; color: #2da4a9; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 12px;">
                                                Contact us
                                            </a>
                                        </td>
                                    </tr>
                                </table>`
                              : ""
                            }

                        </td>
                    </tr>
                </table>

                ${emailFooter(params.email)}

            </td>
        </tr>
    </table>

</body>
</html>`;
}

// ── Public API ──────────────────────────────────────────────────────

export interface MonitoringAlertParams {
  to: string;
  websiteName: string;
  incidentType: string;
  incidentMessage: string;
  incidentTime: string;
  websiteUrl?: string;
}

export interface WelcomeEmailParams {
  to: string;
  websiteName: string;
  websiteUrl: string;
  reportUrl?: string;
}

export interface SendResult {
  messageId: string | null;
  success: boolean;
  error?: string;
}

export async function sendMonitoringAlert(
  params: MonitoringAlertParams,
): Promise<SendResult> {
  const ses = getSESClient();
  const html = buildAlertHtml({ ...params, email: params.to });
  const label = params.incidentType.replace(/_/g, " ");

  try {
    const command = new SendEmailCommand({
      FromEmailAddress: fromAddress(),
      ...(process.env.SES_CONFIGURATION_SET
        ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET }
        : {}),
      Destination: { ToAddresses: [params.to] },
      ReplyToAddresses: ["help@buckysolutions.com"],
      Content: {
        Simple: {
          Subject: {
            Data: `[ParkGrader Alert] ${params.websiteName} — ${label} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
            Charset: "UTF-8",
          },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      },
    });

    const result = await ses.send(command);
    return { messageId: result.MessageId ?? null, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SES error";
    return { messageId: null, success: false, error: message };
  }
}

export async function sendWelcomeEmail(
  params: WelcomeEmailParams,
): Promise<SendResult> {
  const ses = getSESClient();
  const html = buildWelcomeHtml({ ...params, email: params.to });

  try {
    const command = new SendEmailCommand({
      FromEmailAddress: fromAddress(),
      ...(process.env.SES_CONFIGURATION_SET
        ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET }
        : {}),
      Destination: { ToAddresses: [params.to] },
      ReplyToAddresses: ["help@buckysolutions.com"],
      Content: {
        Simple: {
          Subject: {
            Data: `[ParkGrader] Monitoring active — ${params.websiteName}`,
            Charset: "UTF-8",
          },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      },
    });

    const result = await ses.send(command);
    return { messageId: result.MessageId ?? null, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SES error";
    return { messageId: null, success: false, error: message };
  }
}
