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
const client_1 = require("@prisma/client");
const redis_1 = require("redis");
const express_1 = __importDefault(require("express"));
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const redisClient = (0, redis_1.createClient)({
    username: 'default',
    password: 'CmkWtBAuq5hci3mHDphn7zk7pgrF2piO',
    socket: {
        host: 'redis-11025.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11025
    }
});
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
const CheckUrlStatus = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
        const res = yield fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        return res.status === 200 ? "UP" : "DOWN";
    }
    catch (error) {
        return "DOWN";
    }
});
function Monitor() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            while (true) {
                console.log('Monitoring...');
                const monitors = yield prisma.monitor.findMany();
                for (const monitor of monitors) {
                    const status = yield CheckUrlStatus(monitor.url);
                    console.log(monitor);
                    if (status !== monitor.status) {
                        yield prisma.monitor.update({
                            where: { id: monitor.id },
                            data: { status },
                        });
                    }
                    if (status === "DOWN") {
                        const lastAlert = yield prisma.alert.findFirst({
                            where: { monitorId: monitor.id, userId: monitor.userId, type: 'EMAIL' },
                            orderBy: { sentAt: 'desc' }
                        });
                        console.log(lastAlert);
                        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                        if (!lastAlert || lastAlert.sentAt < oneHourAgo) {
                            const user = yield prisma.user.findFirst({ where: { userId: monitor.userId } });
                            if (user && user.email) {
                                yield redisClient.lPush('email', JSON.stringify({ email: user.email, website: monitor.url }));
                                yield prisma.alert.create({
                                    data: { type: 'EMAIL', monitorId: monitor.id, userId: monitor.userId }
                                });
                            }
                        }
                    }
                }
                yield new Promise((resolve) => setTimeout(resolve, 10000)); // Sleep for 10s}
            }
        }
        catch (error) {
            console.error("Monitoring Error:", error);
        }
    });
}
;
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield redisClient.connect();
        console.log('Redis connected, starting server...');
        app.listen(4000, () => {
            Monitor();
            console.log('Server running on port 4000');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
    }
});
startServer();
