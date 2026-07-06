import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// ── Helpers ─────────────────────────────────────────────────────────

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

// ── Alert Email Template ────────────────────────────────────────────

function buildAlertHtml(params: {
  websiteName: string;
  incidentType: string;
  incidentMessage: string;
  incidentTime: string;
  websiteUrl?: string;
}): string {
  const label = params.incidentType.replace(/_/g, " ");
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head><meta charset="utf-8" /></head>
  <body style="margin: 0; background: #F8FAFC; font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC">
      <tbody>
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
              <tbody>
                <tr>
                  <td style="background: #ffffff; border-radius: 12px; padding: 40px;" bgcolor="#ffffff">
                    <img src="https://assets.buckysolutions.com/bucky_logo_parkgrader.svg" alt="ParkGrader" width="170" style="display: block; border: 0;" />
                    <div style="height: 40px;"><br /></div>

                    <h2 style="color: #1a1a1a; font-weight: 600; font-size: 18px; margin: 0 0 10px 0;">
                      ⚠ Monitoring Alert: ${esc(displayLabel)}
                    </h2>

                    <p style="line-height: 24px; margin: 15px 0px 0px; font-size: 16px; color: #0A1628;">
                      <strong>${esc(params.websiteName)}</strong> has a new issue.
                    </p>

                    <p style="line-height: 24px; margin: 10px 0px 0px; font-size: 16px; color: #0A1628;">
                      ${esc(params.incidentMessage)}
                    </p>

                    <p style="line-height: 24px; margin: 10px 0px 0px; font-size: 14px; color: #5B6776;">
                      Detected at: ${esc(params.incidentTime)}
                    </p>

                    ${params.websiteUrl
                      ? `<div style="height: 26px;"><br /></div>
                         <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 6px;"><tbody><tr><td>
                           <a href="${esc(params.websiteUrl)}" style="display:inline-block; background:#2da4a9; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; padding:12px 18px; border-radius: 8px;">Check Website</a>
                         </td></tr></tbody></table>`
                      : ""}
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #edeff2; padding: 30px; border-radius: 0 0 12px 12px;" bgcolor="#edeff2">
                    <img src="https://assets.buckysolutions.com/bucky%2Bicon%2B.png" alt="Icon" width="22" style="margin-bottom: 15px;" />
                    <p style="line-height: 16px; margin: 0px; font-size: 11px; color: rgb(153, 153, 153);">This message was sent automatically by ParkGrader Monitoring.</p>
                    <p style="line-height: 16px; margin: 8px 0 0 0; font-size: 11px; color: rgb(153, 153, 153);">Registered location: Bucky Solutions LLC., 7901 4th St N STE 300, St. Petersburg FL 33702</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
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

export interface SendResult {
  messageId: string | null;
  success: boolean;
  error?: string;
}

/**
 * Send a monitoring alert email via AWS SES.
 */
export async function sendMonitoringAlert(
  params: MonitoringAlertParams,
): Promise<SendResult> {
  const ses = getSESClient();
  const html = buildAlertHtml(params);
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
            Data: `[ParkGrader Alert] ${params.websiteName} — ${label}`,
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
