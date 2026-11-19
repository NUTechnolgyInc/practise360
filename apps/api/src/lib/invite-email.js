// The "join Practise360" email. NULogic-branded, built from tables with inline styles because email clients ignore
// stylesheets, and text-only branding because most clients block remote images and SVG by default.
const BRAND = {
  lapis: "#050766",
  darkTeal: "#133E49",
  mutedTeal: "#3E616A",
  redOrange: "#E62A32",
  purple: "#8939A1",
  nearWhite: "#F4F5F6",
  border: "#E4E5EA",
};
const HEADING = "Montserrat, Arial, Helvetica, sans-serif";
const BODY = "'Open Sans', Arial, Helvetica, sans-serif";

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const formatDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The shared branded layout. `introHtml` is already escaped; everything else is escaped here.
 * `note` sits under the button with the link spelled out, `footer` explains why they got the email.
 */
function brandedEmail({ subject, preheader, heading, introHtml, cta, url, note, footer }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.nearWhite};">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.nearWhite};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <tr><td style="height:6px;line-height:6px;font-size:0;background:${BRAND.redOrange};background-image:linear-gradient(to right,#ED3027,#7B469B);">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0;font-family:${HEADING};font-size:20px;font-weight:800;color:${BRAND.lapis};">Practise360</p>
          <p style="margin:2px 0 0;font-family:${HEADING};font-size:10px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:${BRAND.mutedTeal};">NULogic · Infinite Innovation</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:${HEADING};font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.lapis};">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 16px;font-family:${BODY};font-size:15px;line-height:1.6;color:${BRAND.darkTeal};">
            ${introHtml}
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:999px;background:${BRAND.redOrange};">
              <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 28px;font-family:${HEADING};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(cta)}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0 0 8px;font-family:${BODY};font-size:12px;line-height:1.6;color:${BRAND.mutedTeal};">
            ${escapeHtml(note)} If the button doesn't work, paste this into your browser:
          </p>
          <p style="margin:0;font-family:${BODY};font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:${BRAND.purple};">${escapeHtml(url)}</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:${BRAND.nearWhite};font-family:${BODY};font-size:11px;line-height:1.5;color:${BRAND.mutedTeal};">
          ${escapeHtml(footer)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const inviterLine = (inviter, role, lead) =>
  `<strong>${escapeHtml(inviter)}</strong> ${lead}, NULogic's portal for practices, certifications and AI initiatives, as
            <strong style="color:${BRAND.purple};">${escapeHtml(role)}</strong>.`;

/**
 * `inviter` = who sent it, `role` = what they'll be (e.g. "Manager of Digital Engineering"), `url` = the accept link.
 * Returns { subject, html, text } — the text part is for clients that don't render HTML and for the dev console.
 */
function inviteEmail({ inviter, role, url, expiresAt }) {
  const subject = `${inviter} invited you to Practise360`;
  const until = formatDate(expiresAt);
  const text = [
    `${inviter} invited you to join Practise360, NULogic's internal portal, as ${role}.`,
    "",
    `Join here: ${url}`,
    "",
    `The link works once and expires on ${until}. If you weren't expecting this, you can ignore this email.`,
  ].join("\n");
  const html = brandedEmail({
    subject,
    preheader: `Join Practise360 as ${role}.`,
    heading: "You're invited to Practise360",
    introHtml: inviterLine(inviter, role, "invited you to join Practise360"),
    cta: "Join Practise360",
    url,
    note: `The link works once and expires on ${until}.`,
    footer: "You're getting this because someone at NULogic added your email to a practice. Not expecting it? You can ignore this email.",
  });
  return { subject, html, text };
}

/**
 * Sent when someone is added to Access control by email: the account and its role already exist, so this is only a
 * heads-up with a link to the sign-in page — it isn't a credential. `role` = e.g. "Cert Admin in Certification Tracker".
 */
function accessEmail({ inviter, role, url }) {
  const subject = `${inviter} gave you access to Practise360`;
  const text = [
    `${inviter} gave you access to Practise360, NULogic's internal portal, as ${role}.`,
    "",
    `Sign in with this email address here: ${url}`,
    "",
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");
  const html = brandedEmail({
    subject,
    preheader: `You can now sign in to Practise360 as ${role}.`,
    heading: "You have access to Practise360",
    introHtml: inviterLine(inviter, role, "gave you access to Practise360"),
    cta: "Sign in to Practise360",
    url,
    note: "Sign in with this email address — your role is already set up.",
    footer: "You're getting this because someone at NULogic gave your email a role on Practise360. Not expecting it? You can ignore this email.",
  });
  return { subject, html, text };
}

module.exports = { inviteEmail, accessEmail, escapeHtml };
