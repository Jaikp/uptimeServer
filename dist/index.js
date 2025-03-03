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
const send_1 = __importDefault(require("./send"));
const prisma = new client_1.PrismaClient();
const CheckUrlStatus = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const res = yield fetch(url);
        if (res.status == 200) {
            return "UP";
        }
        return "DOWN";
    }
    catch (error) {
        return "DOWN";
    }
});
const Monitor = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const monitors = yield prisma.monitor.findMany();
        for (const monitor of monitors) {
            const res = yield CheckUrlStatus(monitor.url);
            const status = yield prisma.monitor.findUnique({
                where: {
                    url: monitor.url
                }
            });
            if (res === 'UP' && (status === null || status === void 0 ? void 0 : status.status) === 'DOWN') {
                const website = yield prisma.monitor.update({
                    where: {
                        id: monitor.id
                    },
                    data: {
                        status: "UP"
                    }
                });
            }
            if (res === 'DOWN') {
                const lastAlert = yield prisma.alert.findFirst({
                    where: {
                        monitorId: monitor.id,
                        userId: monitor.userId,
                        type: 'EMAIL'
                    },
                    orderBy: {
                        sentAt: 'desc'
                    }
                });
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                if (!lastAlert || lastAlert.sentAt < oneHourAgo) {
                    const website = yield prisma.monitor.update({
                        where: {
                            id: monitor.id
                        },
                        data: {
                            status: "DOWN"
                        }
                    });
                    const user = yield prisma.user.findUnique({
                        where: {
                            id: monitor.userId
                        }
                    });
                    yield (0, send_1.default)(user === null || user === void 0 ? void 0 : user.email, website);
                    console.log("Email sent");
                    yield prisma.alert.create({
                        data: {
                            type: 'EMAIL',
                            monitorId: monitor.id,
                            userId: monitor.userId
                        }
                    });
                }
            }
        }
    }
    catch (error) {
        console.log(error);
    }
});
function hello() {
    console.log("done");
    Monitor();
}
setInterval(hello, 10000);
