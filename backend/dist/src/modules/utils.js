"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.utilsRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const excel_store_1 = require("../store/excel-store");
exports.utilsRouter = (0, express_1.Router)();
exports.utilsRouter.get('/encryption-key', (_req, res) => {
    const key = node_crypto_1.default.randomBytes(32).toString('base64');
    res.json({ key });
});
exports.utilsRouter.get('/debug-store', (_req, res) => {
    const storePath = (0, excel_store_1.getStorePathForDebug)();
    res.json({
        storePath,
        storeExists: node_fs_1.default.existsSync(storePath),
        storeDirExists: node_fs_1.default.existsSync(node_path_1.default.dirname(storePath)),
        cwd: process.cwd(),
    });
});
