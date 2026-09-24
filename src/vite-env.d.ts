/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** The Telegram bot username the login widget is bound to (identity's Platform:Identity:Telegram:BotUsername). Empty = the button says so. */
  readonly VITE_TELEGRAM_BOT?: string;
}
