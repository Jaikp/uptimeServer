import { createClient } from 'redis';
import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const app = express();
app.use(express.json());

// Email Transporter Setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "jaikp14@gmail.com",  // Use env variable
    pass: process.env.PASS,  // Use env variable
  },
});


const redisClient = createClient({
  username: 'default',
  password: 'IC3KAHoABvswkL40F8pEPxubmb1bT9C6',
  socket: {
      host: 'redis-19458.c305.ap-south-1-1.ec2.redns.redis-cloud.com',
      port: 19458
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

(async () => {
  await redisClient.connect();
})();

// Main Function for Email Queue Processing
async function processEmailQueue() {
  while (true) {
    try {
      const emailData = await redisClient.lPop('email');
      console.log(emailData);
      if (emailData) {
        const { email, website } = JSON.parse(emailData);
        await sendEmailNotification(email, website);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Sleep for 2s if queue is empty
      }
    } catch (error) {
      console.error("Error processing email queue:", error);
    }
  }
}

// Function to Send Email
async function sendEmailNotification(email: string, url: string) {
  try {
    await transporter.sendMail({
      from: "jaikp14@gmail.com", 
      to: email,
      subject: "🚨 Website Down Alert!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          <h2 style="background-color: #ff4d4d; color: white; text-align: center; padding: 15px; border-radius: 8px 8px 0 0;">⚠️ Website Down Alert</h2>
          <p>Hello,</p>
          <p>Your website <strong>${url}</strong> is currently down.</p>
          <p>Please check its status and take necessary action.</p>
          <p style="text-align: center;">
            <a href="${url}" style="display: inline-block; padding: 12px 20px; background: #ff4d4d; color: white; text-decoration: none; font-weight: bold; border-radius: 5px;">Check Website</a>
          </p>
          <hr>
          <p style="font-size: 12px; text-align: center; color: #777;">This is an automated alert from <strong>Uptime Monitor</strong>. Contact support if you need assistance.</p>
        </div>
      `,
    });
    console.log(`📧 Alert sent to ${email} for ${url}`);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
  }
}

// Start Express Server
app.listen(4001, () => {
  console.log('🚀 Server Running on Port 4000');
  processEmailQueue().catch(console.error); // Start the email queue processor
});
