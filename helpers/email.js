const nodemailer = require("nodemailer");

const emailTransporter = nodemailer.createTransport({
  host: "localhost",
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

async function sendEmail(to, subject, html) {
  try {
    const info = await emailTransporter.sendMail({
      from: '"CuePay Alerts" <cuepayalerts@ardthonsolutions.com>',
      to,
      subject,
      text: subject + " - View your CuePay dashboard for details.",
      html,
    });
    console.log("Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("Email error:", err.message);
    return false;
  }
}

module.exports = { sendEmail };
