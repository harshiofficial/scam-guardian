"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardianRouter = exports.alertRouter = void 0;
// ScamGuardian Backend Routes
var alert_1 = require("./alert");
Object.defineProperty(exports, "alertRouter", { enumerable: true, get: function () { return __importDefault(alert_1).default; } });
var guardian_1 = require("./guardian");
Object.defineProperty(exports, "guardianRouter", { enumerable: true, get: function () { return __importDefault(guardian_1).default; } });
//# sourceMappingURL=index.js.map