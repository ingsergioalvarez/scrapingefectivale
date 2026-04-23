"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptString = encryptString;
exports.decryptString = decryptString;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("./config");
function getKey() {
    // 1) Preferimos .env (estático)
    const rawEnv = (config_1.config.encryptionKeyBase64 ?? '').trim();
    if (rawEnv && rawEnv !== 'REPLACE_ME') {
        const key = Buffer.from(rawEnv, 'base64');
        if (key.length === 32)
            return key;
    }
    // 2) Fallback: clave persistente en archivo (se crea 1 sola vez)
    const serverRoot = node_path_1.default.resolve(__dirname, '..');
    const keyFile = node_path_1.default.join(serverRoot, 'data', 'encryption-key.base64');
    try {
        if (node_fs_1.default.existsSync(keyFile)) {
            const raw = node_fs_1.default.readFileSync(keyFile, 'utf8').trim();
            const key = Buffer.from(raw, 'base64');
            if (key.length === 32)
                return key;
        }
    }
    catch {
        // ignore
    }
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(keyFile), { recursive: true });
    const raw = node_crypto_1.default.randomBytes(32).toString('base64');
    node_fs_1.default.writeFileSync(keyFile, raw, 'utf8');
    return Buffer.from(raw, 'base64');
}
function encryptString(plain) {
    const key = getKey();
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = {
        v: 1,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: enc.toString('base64'),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}
function decryptString(ciphertextBase64) {
    const key = getKey();
    const decoded = Buffer.from(ciphertextBase64, 'base64').toString('utf8');
    const payload = JSON.parse(decoded);
    if (!payload || payload.v !== 1)
        throw new Error('Formato de cifrado no soportado');
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const data = Buffer.from(payload.data, 'base64');
    const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString('utf8');
}
