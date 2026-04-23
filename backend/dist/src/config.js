"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const dotenv_1 = __importDefault(require("dotenv"));
function loadDotenv() {
    const explicit = process.env.DOTENV_PATH;
    const candidates = [
        explicit,
        node_path_1.default.resolve(process.cwd(), '.env'),
        node_path_1.default.resolve(process.cwd(), '..', '.env'),
    ].filter(Boolean);
    for (const p of candidates) {
        try {
            if (node_fs_1.default.existsSync(p)) {
                dotenv_1.default.config({ path: p });
                return;
            }
        }
        catch {
            // ignore
        }
    }
    dotenv_1.default.config();
}
loadDotenv();
exports.config = {
    port: Number(process.env.APP_PORT ?? 4000),
    mysql: {
        host: process.env.MYSQL_HOST ?? 'localhost',
        port: Number(process.env.MYSQL_PORT ?? 3306),
        user: process.env.MYSQL_USER ?? 'root',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: process.env.MYSQL_DATABASE ?? 'ConrolVehicular',
    },
    encryptionKeyBase64: process.env.ENCRYPTION_KEY_BASE64 ?? '',
    playwrightHeadless: (process.env.PLAYWRIGHT_HEADLESS ?? 'true').toLowerCase() !== 'false',
};
