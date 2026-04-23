"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptString = encryptString;
exports.decryptString = decryptString;
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = require("./config");
function getKey() {
    const raw = config_1.config.encryptionKeyBase64;
    if (!raw)
        throw new Error('Falta ENCRYPTION_KEY_BASE64 en .env');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32)
        throw new Error('ENCRYPTION_KEY_BASE64 debe ser 32 bytes en base64');
    return key;
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
