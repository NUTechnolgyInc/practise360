// Outgoing email. With SMTP_URL set, mail goes through that SMTP server — any provider works (Google Workspace relay,
// Amazon SES, Resend, SendGrid…). Without it (local dev) the message is printed to the API console instead, so
// invitations still work offline and nobody gets real mail from a dev machine.
const nodemailer = require("nodemailer");

let transport = null;

const mailConfigured = () => !!process.env.SMTP_URL;

/** Sends one message. Never throws: returns { status: "sent" | "logged" | "failed", error? } for the caller to record. */
async function sendMail({ to, subject, html, text }) {
  if (!mailConfigured()) {
    console.log(`\n[mail] SMTP_URL isn't set, so this wasn't sent.\n  To: ${to}\n  Subject: ${subject}\n\n${text}\n`);
    return { status: "logged" };
  }
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || "Practise360 <no-reply@localhost>", to, subject, html, text });
    return { status: "sent" };
  } catch (err) {
    // The SMTP error can name hosts and accounts — keep it in the server log, show people a plain message.
    console.error(`[mail] sending to ${to} failed:`, err.message);
    return { status: "failed", error: "The email couldn't be sent" };
  }
}

module.exports = { sendMail, mailConfigured };
