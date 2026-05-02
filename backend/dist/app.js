"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ScamGuardian Backend — Express Application
 */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./routes");
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'scam-guardian-backend' });
});
// Routes
app.use('/alert', routes_1.alertRouter);
app.use('/guardian', routes_1.guardianRouter);
exports.default = app;
//# sourceMappingURL=app.js.map