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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const redis_1 = require("redis");
const prisma = new client_1.PrismaClient();
const redisClient = (0, redis_1.createClient)({
    username: 'default',
    password: 'CmkWtBAuq5hci3mHDphn7zk7pgrF2piO',
    socket: {
        host: 'redis-11025.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11025
    }
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient.connect();
}))();
// Function to Check Website Status
const CheckUrlStatus = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const res = yield fetch(url);
        return res.status === 200 ? "UP" : "DOWN";
    }
    catch (error) {
        return "DOWN";
    }
});
// Monitoring Function
const Monitor = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const monitors = yield prisma.monitor.findMany();
        for (const monitor of monitors) {
            const status = yield CheckUrlStatus(monitor.url);
            // Update Database Only if Status Changes
            if (status !== monitor.status) {
                yield prisma.monitor.update({
                    where: { id: monitor.id },
                    data: { status },
                });
                // Handle Alerting for DOWN Status
                if (status === "DOWN") {
                    const lastAlert = yield prisma.alert.findFirst({
                        where: { monitorId: monitor.id, userId: monitor.userId, type: 'EMAIL' },
                        orderBy: { sentAt: 'desc' }
                    });
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    if (!lastAlert || lastAlert.sentAt < oneHourAgo) {
                        const user = yield prisma.user.findUnique({ where: { id: monitor.userId } });
                        yield redisClient.lPush('email', JSON.stringify({ email: user === null || user === void 0 ? void 0 : user.email, website: monitor.url }));
                        yield prisma.alert.create({
                            data: { type: 'EMAIL', monitorId: monitor.id, userId: monitor.userId }
                        });
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("Monitoring Error:", error);
    }
});
// Run Monitor Every 10 Seconds
setInterval(Monitor, 10000);
exports.default = redisClient;
