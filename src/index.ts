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


redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    await redisClient.connect();
})();


const CheckUrlStatus = async (url: string): Promise<string> => {
    try {
        const res = await fetch(url);
        return res.status === 200 ? "UP" : "DOWN";
    } catch (error) {
        return "DOWN";
    }
};

// Monitoring Function
const Monitor = async () => {
    try {
        const monitors = await prisma.monitor.findMany();
        for (const monitor of monitors) {
            const status = await CheckUrlStatus(monitor.url);

            // Update Database Only if Status Changes
            if (status !== monitor.status) {
                await prisma.monitor.update({
                    where: { id: monitor.id },
                    data: { status },
                });

                // Handle Alerting for DOWN Status
                if (status === "DOWN") {
                    const lastAlert = await prisma.alert.findFirst({
                        where: { monitorId: monitor.id, userId: monitor.userId, type: 'EMAIL' },
                        orderBy: { sentAt: 'desc' }
                    });

                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    if (!lastAlert || lastAlert.sentAt < oneHourAgo) {
                        const user = await prisma.user.findUnique({ where: { id: monitor.userId } });

                        await redisClient.lPush('email', JSON.stringify({ email: user?.email, website: monitor.url }));

                        await prisma.alert.create({
                            data: { type: 'EMAIL', monitorId: monitor.id, userId: monitor.userId }
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Monitoring Error:", error);
    }
};

// Run Monitor Every 10 Seconds
setInterval(Monitor, 10000);

app.listen(3000, () => console.log('Server Running on Port 3000'));

export default redisClient;
