import "server-only";

/** Segredos — disponíveis somente no servidor. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  superFreteToken: process.env.SUPERFRETE_TOKEN ?? "",
  superFreteEnv: (process.env.SUPERFRETE_ENV ?? "production") as "production" | "sandbox",
  superFreteWebhookSecret: process.env.SUPERFRETE_WEBHOOK_SECRET ?? "",
  superFreteContactEmail: process.env.SUPERFRETE_CONTACT_EMAIL ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Eloah Make Up <pedidos@eloahmakeup.com>",
  emailReplyTo: process.env.EMAIL_REPLY_TO ?? "",
  storeNotifyEmail: process.env.STORE_NOTIFY_EMAIL ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "https://eloahmakeup.com",
};

export const integrations = {
  get supabaseAdmin() {
    return Boolean(serverEnv.supabaseServiceRoleKey);
  },
  get mercadoPago() {
    return Boolean(serverEnv.mercadoPagoAccessToken && process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
  },
  get superFrete() {
    return Boolean(serverEnv.superFreteToken);
  },
  get email() {
    return Boolean(serverEnv.resendApiKey);
  },
  get push() {
    return Boolean(serverEnv.vapidPublicKey && serverEnv.vapidPrivateKey);
  },
};
