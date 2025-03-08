import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { collectDefaultMetrics, register, Gauge } from 'prom-client';
import express from 'express';

const prisma = new PrismaClient();
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

// Prometheus Setup
const app = express();
collectDefaultMetrics(); // Collect default Node.js metrics

const websiteUptimeGauge = new Gauge({
    name: 'website_up',
    help: 'Website status (1 = UP, 0 = DOWN)',
    labelNames: ['url'],
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// Function to Check Website Status
const CheckUrlStatus = async (url: string): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // Timeout after 5 sec
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        
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
            
            // Update Prometheus Metrics
            websiteUptimeGauge.labels(monitor.url).set(status === "UP" ? 1 : 0);

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

// Start Prometheus Metrics Server
app.listen(3001, () => console.log('Prometheus metrics server running on port 3001'));

export default redisClient;
