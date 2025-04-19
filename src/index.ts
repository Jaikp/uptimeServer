import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import express from 'express';

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

const redisClient = createClient({
    username: 'default',
    password: 'CmkWtBAuq5hci3mHDphn7zk7pgrF2piO',
    socket: {
        host: 'redis-11025.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11025
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

const CheckUrlStatus = async (url: string): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        return res.status === 200 ? "UP" : "DOWN";
    } catch (error) {
        return "DOWN";
    }
};

async function Monitor(){
    try {
        while(true){
            console.log('Monitoring...');
            const monitors = await prisma.monitor.findMany();
            for (const monitor of monitors) {
                const status = await CheckUrlStatus(monitor.url);
                
                if (status !== monitor.status) {
                    await prisma.monitor.update({
                        where: { id: monitor.id },
                        data: { status },
                    });
                }
                    if (status === "DOWN") {
                        const lastAlert = await prisma.alert.findFirst({
                            where: { monitorId: monitor.id, userId: monitor.userId, type: 'EMAIL' },
                            orderBy: { sentAt: 'desc' }
                        });
                        
                        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                        if (!lastAlert || lastAlert.sentAt < oneHourAgo) {
                            const user = await prisma.user.findFirst({ where: { userId: monitor.userId } });
                            
                            if (user && user.email) {
                                await redisClient.lPush('email', JSON.stringify({ email: user.email, website: monitor.url }));

                                await prisma.alert.create({
                                    data: { type: 'EMAIL', monitorId: monitor.id, userId: monitor.userId }
                                });
                            }
                        }
                    }
                
            }
            await new Promise((resolve) => setTimeout(resolve,18000000));
        }
    } catch (error) {
        console.error("Monitoring Error:", error);
    }
};

const startServer = async () => {
    try {
        await redisClient.connect();
        console.log('Redis connected, starting server...');

        app.listen(4000, () => {
            Monitor();
            console.log('Server running on port 4000');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
};

startServer();

