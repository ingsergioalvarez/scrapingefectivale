"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.pingDb = pingDb;
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("./config");
exports.pool = promise_1.default.createPool({
    host: config_1.config.mysql.host,
    port: config_1.config.mysql.port,
    user: config_1.config.mysql.user,
    password: config_1.config.mysql.password,
    database: config_1.config.mysql.database,
    connectionLimit: 10,
    namedPlaceholders: true,
    timezone: 'Z',
});
async function pingDb() {
    const conn = await exports.pool.getConnection();
    try {
        await conn.ping();
    }
    finally {
        conn.release();
    }
}
