"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const express_1 = __importDefault(require("express"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load environment variables
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Email Transporter Setup
const transporter = nodemailer_1.default.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "jaikp14@gmail.com", // Use env variable
        pass: process.env.PASS, // Use env variable
    },
});
const redisClient = (0, redis_1.createClient)({
    username: 'default',
    password: 'CmkWtBAuq5hci3mHDphn7zk7pgrF2piO',
    socket: {
        host: 'redis-11025.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11025
    }
});
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient.connect();
}))();
// Main Function for Email Queue Processing
function processEmailQueue() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            try {
                const emailData = yield redisClient.lPop('email');
                console.log(emailData);
                if (emailData) {
                    const { email, website } = JSON.parse(emailData);
                    yield sendEmailNotification(email, website);
                }
                else {
                    yield new Promise((resolve) => setTimeout(resolve, 2000)); // Sleep for 2s if queue is empty
                }
            }
            catch (error) {
                console.error("Error processing email queue:", error);
            }
        }
    });
}
// Function to Send Email
function sendEmailNotification(email, url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield transporter.sendMail({
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
        }
        catch (error) {
            console.error("❌ Failed to send email:", error);
        }
    });
}
// Start Express Server
app.listen(4001, () => {
    console.log('🚀 Server Running on Port 4000');
    processEmailQueue().catch(console.error); // Start the email queue processor
});
