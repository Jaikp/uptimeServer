
import { createClient } from 'redis';
import express from 'express';
const app = express();
app.use(express.json());

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

const redisClient = createClient({
    username: 'default',
    password: 'CmkWtBAuq5hci3mHDphn7zk7pgrF2piO',
    socket: {
        host: 'redis-11025.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11025
    }
});


redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    await redisClient.connect();
})();


async function main(){
    while(true){
        const emailData = await redisClient.lPop('email');
        if (emailData) {
            const { email, website } = JSON.parse(emailData);
            await CreateEmail(email, website);
        }
        else{
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}


async function CreateEmail(email: any, url: string) {

  const info = await transporter.sendMail({
    from: 'jaikp14@gmail.com', 
    to: email,
    subject: "Hello from Uptime",
    text: "You website is down",
    html: `
    <!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #ff4d4d;
            color: white;
            text-align: center;
            padding: 15px;
            font-size: 20px;
            border-radius: 8px 8px 0 0;
        }
        .content {
            padding: 20px;
            font-size: 16px;
            color: #333;
            text-align: center;
        }
        .button {
            display: inline-block;
            padding: 12px 20px;
            margin: 20px 0;
            color: white;
            background-color: #ff4d4d;
            text-decoration: none;
            font-weight: bold;
            border-radius: 5px;
        }
        .footer {
            font-size: 14px;
            color: #777;
            text-align: center;
            padding: 15px;
            border-top: 1px solid #ddd;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ⚠️ Website Down Alert
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>We detected that your website <strong>${url}</strong> is currently down.</p>
            <p>Please check your website status and take necessary actions.</p>
            <a href="${url}" class="button">Check Website</a>
        </div>
        <div class="footer">
            This is an automated message from <strong>Uptime Monitor</strong>. If you need assistance, please contact support.
        </div>
    </div>
</body>
</html>
`,
  });
}
app.listen(4000, () => {
    main().catch(console.error);
    console.log('Server Running on Port 4000');
}
);

