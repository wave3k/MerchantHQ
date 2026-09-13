import { render } from "@react-email/render";
import { VerifyEmail } from "./emails/VerifyEmail";
import { WelcomeEmail } from "./emails/WelcomeEmail";

export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_AUDIENCE_ID?: string;
}

// Expéditeur humain sur le domaine dédié support.hqmerchant.xyz.
const FROM_SUPPORT = "Enzo de MerchantHQ <enzo@support.hqmerchant.xyz>";
// Expéditeur humain sur le domaine principal hqmerchant.xyz.
const FROM_MAIN = "Enzo de MerchantHQ <enzo@hqmerchant.xyz>";

export async function sendVerificationEmail(
  env: EmailEnv,
  to: string,
  code: string,
  shopName: string,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM || FROM_SUPPORT;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY absent, e-mail de vérification non envoyé.");
    return;
  }
  const html = await render(
    <VerifyEmail code={code} shopName={shopName} />,
  );
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Votre code de vérification MerchantHQ",
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn("[email] Resend a répondu", res.status, detail.slice(0, 300));
    throw new Error("L’e-mail de vérification n’a pas pu être envoyé.");
  }
}

// Enregistre l'adresse dans l'audience Resend (newsletter / contacts).
// L'audience doit être créée au préalable dans le dashboard Resend.
export async function addContactToAudience(
  env: EmailEnv,
  email: string,
  firstName?: string,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const audienceId = env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.warn("[email] RESEND_API_KEY ou audience absent, contact non ajouté.");
    return;
  }
  const res = await fetch(
    `https://api.resend.com/audiences/${audienceId}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        first_name: firstName ?? "",
        unsubscribed: false,
      }),
    },
  );
  if (!res.ok && res.status !== 409) {
    const detail = await res.text().catch(() => "");
    console.warn("[email] Resend contact a répondu", res.status, detail.slice(0, 300));
  }
}

export async function sendWelcomeEmail(
  env: EmailEnv,
  to: string,
  shopName: string,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM || FROM_MAIN;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY absent, e-mail de bienvenue non envoyé.");
    return;
  }
  const html = await render(
    <WelcomeEmail shopName={shopName} siteUrl="https://hqmerchant.xyz" />,
  );
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: "enzo@hqmerchant.xyz",
      subject: "MerchantHQ, bienvenue",
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn("[email] Resend bienvenue a répondu", res.status, detail.slice(0, 300));
    throw new Error("L’e-mail de bienvenue n’a pas pu être envoyé.");
  }
}