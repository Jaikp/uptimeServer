const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "jaikp14@gmail.com",
    pass: process.env.PASS,
  },
});

// async..await is not allowed in global scope, must use a wrapper
async function CreateEmail(email: any, website: { id: string; url: string; status: string; frequency: number; userId: string; createdAt: Date; updatedAt: Date; }) {

  const info = await transporter.sendMail({
    from: 'jaikp14@gmail.com', 
    to: email,
    subject: "Hello from Uptime",
    text: "You website is down",
    html: `You website ${website.url} is down</b>`,
  });

  console.log("Message sent: %s", info);
}

export default CreateEmail;