import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendVerificationCode(email: string, code: string) {
  const mailOptions = {
    from: '"Moodies Support" <no-reply@moodies.com>',
    to: email,
    subject: 'Moodies Password Reset Code',
    text: `Your password reset verification code is ${code}. 
It will expire in 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Sent verification code ${code} to ${email}`);
}
