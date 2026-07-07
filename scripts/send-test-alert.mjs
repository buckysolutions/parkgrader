#!/usr/bin/env node

/**
 * Send a test monitoring alert email via AWS SES.
 *
 * Usage: node scripts/send-test-alert.mjs
 *
 * Reads SES credentials from .env.local (same pattern as other scripts).
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const esc = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>ParkGrader Alert — Test</title>
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

                            <img src="https://assets.buckysolutions.com/parkgrader%2Blogo.png" alt="ParkGrader" width="180" class="email-logo" style="display: block; max-width: 180px; width: 100%; height: auto; margin-bottom: 40px; border: 0;">

                            <p style="color: #888888; font-size: 16px; line-height: 24px; margin: 0 0 6px 0;">
                                Monitoring Alert
                            </p>
                            <p style="color: #000000; font-size: 22px; font-weight: bold; line-height: 28px; margin: 0 0 30px 0;">
                                Test — Example Campground
                            </p>

                            <!-- Issue info -->
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0;">
                                <span style="color: #888888;">Issue:</span> <span style="color: #000000;">Homepage Down</span>
                            </p>
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 15px 0;">
                                <span style="color: #888888;">Details:</span> <span style="color: #000000;">Homepage returned HTTP 500. Visitors may be unable to access your website.</span>
                            </p>
                            <p style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                                <span style="color: #888888;">Detected:</span> <span style="color: #000000;">${new Date().toLocaleString()}</span>
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
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                                <tr>
                                    <td align="center" class="email-btn-td" style="border-radius: 12px; background-color: #2da4a9;">
                                        <a href="https://example.com" style="display: block; width: 100%; padding: 18px 0; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 12px;">
                                            Check your website
                                        </a>
                                    </td>
                                </tr>
                            </table>

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

                <!-- Footer -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" class="email-inner" style="max-width: 600px; margin: 0 auto;">
                    <tr>
                        <td align="center" style="padding: 15px 0 0 0; color: #999999; font-size: 12px;">
                            &copy; ${new Date().getFullYear()} Bucky Solutions LLC &middot; All Rights Reserved
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>

</body>
</html>`;
}

async function main() {
  loadEnvConfig(process.cwd());

  const region = process.env.SES_AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const fromName = process.env.SES_FROM_NAME || "ParkGrader";
  const fromEmail = process.env.SES_FROM_EMAIL || "alerts@parkgrader.com";

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing SES credentials in .env.local");
  }

  const ses = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const out = await ses.send(new SendEmailCommand({
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    Destination: { ToAddresses: ["brian@buckysolutions.com"] },
    ReplyToAddresses: ["help@buckysolutions.com"],
    Content: {
      Simple: {
        Subject: { Data: "[ParkGrader Alert] Test — Homepage Down", Charset: "UTF-8" },
        Body: { Html: { Data: buildHtml(), Charset: "UTF-8" } },
      },
    },
  }));

  console.log(`✅ Test email sent! Message ID: ${out.MessageId}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
