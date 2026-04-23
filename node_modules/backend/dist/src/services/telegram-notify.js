"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTelegramBotForNotify = registerTelegramBotForNotify;
exports.unregisterTelegramBotForNotify = unregisterTelegramBotForNotify;
exports.notifyTelegramUser = notifyTelegramUser;
let botRef = null;
function registerTelegramBotForNotify(bot) {
    botRef = bot;
}
function unregisterTelegramBotForNotify() {
    botRef = null;
}
async function notifyTelegramUser(chatId, text) {
    if (!botRef)
        return false;
    try {
        await botRef.sendMessage(chatId, text);
        return true;
    }
    catch {
        return false;
    }
}
