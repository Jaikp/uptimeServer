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
const prom_client_1 = require("prom-client");
const express_1 = __importDefault(require("express"));
const prisma = new client_1.PrismaClient();
const redisClient = (0, redis_1.createClient)();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield redisClient.connect();
}))();
// Prometheus Setup
const app = (0, express_1.default)();
(0, prom_client_1.collectDefaultMetrics)(); // Collect default Node.js metrics
const websiteUptimeGauge = new prom_client_1.Gauge({
    name: 'website_up',
    help: 'Website status (1 = UP, 0 = DOWN)',
    labelNames: ['url'],
});
app.get('/metrics', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.set('Content-Type', prom_client_1.register.contentType);
    res.end(yield prom_client_1.register.metrics());
}));
// Function to Check Website Status
const CheckUrlStatus = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // Timeout after 5 sec
        const res = yield fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
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
            // Update Prometheus Metrics
            websiteUptimeGauge.labels(monitor.url).set(status === "UP" ? 1 : 0);
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
// Start Prometheus Metrics Server
app.listen(3001, () => console.log('Prometheus metrics server running on port 3001'));
exports.default = redisClient;
