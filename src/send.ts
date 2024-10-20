const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: "jaikp14@gmail.com",
    pass: process.env.PASS,
  },
});

// async..await is not allowed in global scope, must use a wrapper
async function CreateEmail(email: any, website: { id: string; url: string; status: string; frequency: number; userId: string; createdAt: Date; updatedAt: Date; }) {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: 'jaikp14@gmail.com', // sender address
    to: email, // list of receivers
    subject: "Hello from Uptime", // Subject line
    text: "You website is down", // plain text body
    html: `You website ${website.url} is down</b>`, // html body
  });

  console.log("Message sent: %s", info);
  // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
}

export default CreateEmail;