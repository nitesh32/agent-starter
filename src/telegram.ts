import "dotenv/config";
import { Bot } from "grammy";

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN ?? "");

bot.on("message:text", (ctx) => ctx.reply(ctx.message.text));

export function startBot() {
  return bot.start();
}
