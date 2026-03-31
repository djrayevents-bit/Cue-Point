const { Resend } = require("resend");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { type, data } = req.body;

  if (!type || !data) return res.status(400).json({ error: "type and data required" });

  try {
    let emails = [];

    switch (type) {

      // ── New booking request from public form ────────────────────────────
      case "new_booking": {
        const { djEmail, djName, businessName, clientName, clientEmail, clientPhone, eventType, eventDate, venue, guestCount, packageName, addOns, notes, total } = data;

        // 1. Notify the DJ
        emails.push({
          from: `CuePoint Planning <notifications@cuepointplanning.com>`,
          to: djEmail,
          subject: `🎧 New Booking Request from ${clientName}`,
          html: emailTemplate({
            title: "New Booking Request",
            preview: `${clientName} just submitted a booking request`,
            body: `
              <p>You have a new booking request from <strong>${clientName}</strong>.</p>
              ${infoTable([
                ["Client", clientName],
                ["Email", clientEmail],
                ["Phone", clientPhone || "—"],
                ["Event Type", eventType || "—"],
                ["Event Date", eventDate || "—"],
                ["Venue", venue || "—"],
                ["Guest Count", guestCount || "—"],
                ["Package", packageName || "—"],
                ["Add-Ons", addOns?.length ? addOns.join(", ") : "None"],
                ["Estimated Total", total ? `$${Number(total).toLocaleString()}` : "—"],
                ["Notes", notes || "—"],
              ])}
              <p style="margin-top:24px;">
                <a href="https://cuepointplanning.com/#/leads" style="background:#0EA5E9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
                  View in CuePoint →
                </a>
              </p>
            `,
          }),
        });

        // 2. Auto-reply to client
        const defaultReply = `Thanks for reaching out! We've received your booking request and will be in touch soon to confirm availability and next steps.\n\nIf you have any questions in the meantime, feel free to reply to this email.`;
        const customReply = (data.replyMessage || "").trim();
        // Replace variables in custom message
        const replyBody = (customReply || defaultReply)
          .replace(/\{clientName\}/g, clientName)
          .replace(/\{eventDate\}/g, eventDate || "")
          .replace(/\{packageName\}/g, packageName || "")
          .split("\n")
          .map(line => line.trim() ? `<p>${line}</p>` : "")
          .join("");

        emails.push({
          from: `${businessName || djName || "Your DJ"} via CuePoint <notifications@cuepointplanning.com>`,
          to: clientEmail,
          replyTo: djEmail,
          subject: `We received your booking request!`,
          html: emailTemplate({
            title: "Request Received!",
            preview: "We'll be in touch soon to confirm your booking",
            body: `
              <p>Hi ${clientName},</p>
              ${replyBody}
              <p>— ${djName || businessName || "Your DJ"}</p>
            `,
          }),
        });
        break;
      }

      // ── Contract signed by client ────────────────────────────────────────
      case "contract_signed": {
        const { djEmail, djName, clientName, clientEmail, eventDate, contractTitle } = data;

        // Notify DJ
        emails.push({
          from: `CuePoint Planning <notifications@cuepointplanning.com>`,
          to: djEmail,
          subject: `✍️ Contract Signed by ${clientName}`,
          html: emailTemplate({
            title: "Contract Signed",
            preview: `${clientName} just signed their contract`,
            body: `
              <p><strong>${clientName}</strong> has signed their contract.</p>
              ${infoTable([
                ["Client", clientName],
                ["Contract", contractTitle || "—"],
                ["Event Date", eventDate || "—"],
                ["Signed", new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
              ])}
              <p style="margin-top:24px;">
                <a href="https://cuepointplanning.com/#/contracts" style="background:#0EA5E9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
                  View Contract →
                </a>
              </p>
            `,
          }),
        });

        // Confirm to client
        if (clientEmail) {
          emails.push({
            from: `${djName || "Your DJ"} via CuePoint <notifications@cuepointplanning.com>`,
            to: clientEmail,
            replyTo: djEmail,
            subject: `Your contract is signed — you're all set!`,
            html: emailTemplate({
              title: "Contract Confirmed",
              preview: "Your signed contract has been recorded",
              body: `
                <p>Hi ${clientName},</p>
                <p>Your contract has been signed and recorded. You're all set!</p>
                ${eventDate ? `<p><strong>Event Date:</strong> ${eventDate}</p>` : ""}
                <p>You'll receive further details about your event as the date approaches. Reply to this email with any questions.</p>
                <p>— ${djName || "Your DJ"}</p>
              `,
            }),
          });
        }
        break;
      }

      // ── Invoice marked as paid ───────────────────────────────────────────
      case "invoice_paid": {
        const { djEmail, djName, clientName, clientEmail, eventDate, amount, invoiceId } = data;

        // Notify DJ
        emails.push({
          from: `CuePoint Planning <notifications@cuepointplanning.com>`,
          to: djEmail,
          subject: `💰 Payment Received from ${clientName}`,
          html: emailTemplate({
            title: "Payment Received",
            preview: `${clientName} made a payment of $${Number(amount).toLocaleString()}`,
            body: `
              <p>A payment has been recorded for <strong>${clientName}</strong>.</p>
              ${infoTable([
                ["Client", clientName],
                ["Amount", `$${Number(amount).toLocaleString()}`],
                ["Event Date", eventDate || "—"],
                ["Date Recorded", new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
              ])}
              <p style="margin-top:24px;">
                <a href="https://cuepointplanning.com/#/invoices" style="background:#0EA5E9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
                  View Invoice →
                </a>
              </p>
            `,
          }),
        });

        // Receipt to client
        if (clientEmail) {
          emails.push({
            from: `${djName || "Your DJ"} via CuePoint <notifications@cuepointplanning.com>`,
            to: clientEmail,
            replyTo: djEmail,
            subject: `Payment received — thank you!`,
            html: emailTemplate({
              title: "Payment Confirmed",
              preview: `Your payment of $${Number(amount).toLocaleString()} has been received`,
              body: `
                <p>Hi ${clientName},</p>
                <p>We've received your payment of <strong>$${Number(amount).toLocaleString()}</strong>. Thank you!</p>
                ${eventDate ? `<p><strong>Event Date:</strong> ${eventDate}</p>` : ""}
                <p>Reply to this email with any questions.</p>
                <p>— ${djName || "Your DJ"}</p>
              `,
            }),
          });
        }
        break;
      }

      // ── Questionnaire submitted by client ────────────────────────────────
      case "questionnaire_submitted": {
        const { djEmail, djName, clientName, eventDate } = data;

        emails.push({
          from: `CuePoint Planning <notifications@cuepointplanning.com>`,
          to: djEmail,
          subject: `📋 Questionnaire Submitted by ${clientName}`,
          html: emailTemplate({
            title: "Questionnaire Submitted",
            preview: `${clientName} just completed their event questionnaire`,
            body: `
              <p><strong>${clientName}</strong> has submitted their event questionnaire.</p>
              ${infoTable([
                ["Client", clientName],
                ["Event Date", eventDate || "—"],
                ["Submitted", new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
              ])}
              <p style="margin-top:24px;">
                <a href="https://cuepointplanning.com/#/events" style="background:#0EA5E9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
                  View Responses →
                </a>
              </p>
            `,
          }),
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown email type: ${type}` });
    }

    // Send all emails
    const results = await Promise.allSettled(
      emails.map(email => resend.emails.send(email))
    );

    const errors = results
      .filter(r => r.status === "rejected")
      .map(r => r.reason?.message);

    if (errors.length) {
      console.error("Some emails failed:", errors);
    }

    return res.status(200).json({
      sent: results.filter(r => r.status === "fulfilled").length,
      failed: errors.length,
      errors,
    });

  } catch (err) {
    console.error("send-email error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ── Email template helpers ─────────────────────────────────────────────────

function emailTemplate({ title, preview, body }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preview}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0EA5E9;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.02em;">CUE POINT</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.15em;margin-top:2px;">PLANNING</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#fff;border-radius:0 0 12px 12px;padding:32px;color:#1A1A2E;font-size:15px;line-height:1.6;">
            <h2 style="font-size:20px;font-weight:800;margin:0 0 20px;color:#1A1A2E;">${title}</h2>
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 0;text-align:center;font-size:11px;color:#A1A1AA;">
            Sent by CuePoint Planning · <a href="https://cuepointplanning.com" style="color:#0EA5E9;text-decoration:none;">cuepointplanning.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoTable(rows) {
  const rowsHtml = rows
    .filter(([, val]) => val && val !== "—")
    .map(([label, val]) => `
      <tr>
        <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#71717A;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;width:140px;">${label}</td>
        <td style="padding:8px 12px;font-size:14px;color:#1A1A2E;">${val}</td>
      </tr>
    `).join("");
  return `<table style="width:100%;border-collapse:collapse;background:#F9F9FB;border-radius:8px;overflow:hidden;margin:16px 0;">${rowsHtml}</table>`;
}
