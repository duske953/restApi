const { send } = require("express/lib/response");
const nodemailer = require("nodemailer");

async function sendMail(emailReceiver, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let mailOptions = {
      from: process.env.EMAIL_BUSINESS_ADDRESS,
      to: emailReceiver,
      subject,
      text,
    };

    return await transporter.sendMail(mailOptions);
  } catch (err) {
    throw err;
  }
}

module.exports = sendMail;
