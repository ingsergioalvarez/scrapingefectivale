import type TelegramBot from 'node-telegram-bot-api'

let botRef: TelegramBot | null = null

export function registerTelegramBotForNotify(bot: TelegramBot) {
  botRef = bot
}

export function unregisterTelegramBotForNotify() {
  botRef = null
}

export async function notifyTelegramUser(chatId: number, text: string): Promise<boolean> {
  if (!botRef) return false
  try {
    await botRef.sendMessage(chatId, text)
    return true
  } catch {
    return false
  }
}
