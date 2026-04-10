import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const esc = (v) => String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const email = "brian@buckysolutions.com";
const propertyName = "Western Kentucky RV Park";
const reportId = "manual-exact-email-preview-20260410-v4";
const reportLink = `https://parkgrader.com/r/${encodeURIComponent(reportId)}`;

let aiSummary = "Some parts of your site are already working well, but issues like Fee transparency and XML sitemap may still be causing guests to hesitate before booking.";

try {
  const prompt = [
    "Write ONE short paragraph (2 sentences max) for an automated audit email.",
    "Tone: professional, helpful, plain-English, not salesy.",
    "Goal: explain what likely needs fixing and why it matters for bookings.",
    "Do NOT use bullet points, headings, emojis, or placeholders.",
    "Do NOT mention AI, model, or scoring formulas.",
    `Property: ${propertyName}`,
    "Top observed issues: Fee transparency, XML sitemap",
  ].join("\n");

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-2.0-flash-lite")}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY || "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 140 },
    }),
  });

  if (r.ok) {
    const d = await r.json();
    const t = (d?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(" ").trim();
    if (t) aiSummary = t.replace(/\s+/g, " ").trim();
  }
} catch {}

const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; background-color: #e3e3e3; table-layout: fixed; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;" bgcolor="#e3e3e3">
      <tbody>
        <tr>
          <td align="center" style="-webkit-font-smoothing: antialiased; color: #444444; padding: 30px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; background-color: #f2f4f7; border-top: 4px solid #2da4a9; border-collapse: separate; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;" bgcolor="#f2f4f7">
              <tbody>
                <tr>
                  <td style="-webkit-font-smoothing: antialiased; color: #444444; padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="-webkit-font-smoothing: antialiased; color: #444444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <tbody>
                        <tr>
                          <td align="left" style="-webkit-font-smoothing: antialiased; color: #444444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                            <img src="https://assets.buckysolutions.com/bucky_logo_parkgrader.svg" alt="ParkGrader Logo" width="170" style="display: block; border: 0;" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div style="height: 40px;"><br /></div>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 0px; font-size: 16px;">Your ParkGrader audit is ready.</p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">We reviewed your website and identified a few areas that may be reducing guest confidence or making it harder for people to book.</p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">${esc(aiSummary)}</p>
                    <p style="-webkit-font-smoothing: antialiased; line-height: 24px; margin: 15px 0px 0px; font-size: 16px;">If you have questions about your results, the best way to get feedback is to reply to this email.</p>
                    <div style="height: 26px;"><br /></div>
                    <h2 style="color: #1a1a1a; font-weight: 600; font-size: 16px; margin: 0 0 10px 0;">View your report</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 6px;"><tbody><tr><td>
                      <a href="${esc(reportLink)}" style="display:inline-block; background:#2da4a9; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; padding:12px 18px;">Open report</a>
                    </td></tr></tbody></table>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #edeff2; padding: 40px;" bgcolor="#edeff2">
                    <img src="https://assets.buckysolutions.com/bucky%2Bicon%2B.png" alt="Icon" width="22" style="margin-bottom: 15px;" />
                    <p style="line-height: 16px; margin: 0px; font-size: 11px; color: rgb(153, 153, 153);">This message was sent automatically by ParkGrader.</p>
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

const ses = new SESv2Client({
  region: process.env.SES_AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const from = process.env.SES_FROM_NAME
  ? `${process.env.SES_FROM_NAME} <${process.env.SES_FROM_EMAIL}>`
  : process.env.SES_FROM_EMAIL;

const out = await ses.send(new SendEmailCommand({
  FromEmailAddress: from,
  ...(process.env.SES_CONFIGURATION_SET ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET } : {}),
  Destination: { ToAddresses: [email] },
  ReplyToAddresses: ["help@buckysolutions.com"],
  Content: {
    Simple: {
      Subject: { Data: "[TEST] ParkGrader exact-template email", Charset: "UTF-8" },
      Body: { Html: { Data: html, Charset: "UTF-8" } },
    },
  },
}));

console.log(JSON.stringify({
  messageId: out.MessageId || null,
  reportLink,
  aiSummary,
}, null, 2));
