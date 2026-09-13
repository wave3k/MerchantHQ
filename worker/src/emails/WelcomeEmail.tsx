import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  shopName: string;
  siteUrl?: string;
}

const PRIMARY = "#1D55C5";
const INK = "#111827";
const MUTED = "#6B7280";

export function WelcomeEmail({ shopName, siteUrl = "https://hqmerchant.xyz" }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>MerchantHQ, bienvenue</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>MerchantHQ</Text>
          <Heading style={title}>Bonjour{shopName ? `, ${shopName}` : ""}</Heading>
          <Text style={paragraph}>
            Votre adresse e-mail est confirmée et votre compte est prêt.
          </Text>
          <Text style={paragraph}>
            Pour activer votre abonnement et la sauvegarde automatique sur
            toutes vos tablettes, écrivez-nous simplement :
          </Text>
          <Text style={contact}>
            service client — WhatsApp +243 0980035037
            {"\n"}
            contact@hqmerchant.xyz
          </Text>
          <Text style={paragraph}>
            Vous pouvez aussi découvrir le service ici :{" "}
            <a href={siteUrl} style={link}>
              {siteUrl}
            </a>
          </Text>
          <Text style={paragraph}>
            Une petite question : répondez-moi simplement OUI si vous avez bien
            reçu ce message.
          </Text>
          <Text style={paragraph}>
            Si ce mail arrive dans vos promotions, ajoutez mon adresse à vos
            contacts pour le retrouver dans votre boîte principale.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            MerchantHQ — votre boutique, toutes vos tablettes.{" "}
            <a href={`mailto:desabonnement@hqmerchant.xyz?subject=Desabonnement`} style={unsubLink}>
              Me désabonner
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#FFFFFF",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 16px",
};

const container = {
  margin: "0 auto",
  maxWidth: "520px",
};

const brand = {
  color: PRIMARY,
  fontSize: "18px",
  fontWeight: 700,
  margin: "0 0 20px",
};

const title = {
  color: INK,
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 12px",
};

const paragraph = {
  color: INK,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "10px 0",
};

const contact = {
  backgroundColor: "#F3F4F6",
  borderRadius: "8px",
  color: INK,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "16px 0",
  padding: "14px 16px",
  whiteSpace: "pre-line" as const,
};

const link = {
  color: PRIMARY,
  textDecoration: "none",
};

const hr = {
  borderColor: "#E5E7EB",
  margin: "24px 0 16px",
};

const footer = {
  color: MUTED,
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
};

const unsubLink = {
  color: MUTED,
  textDecoration: "underline",
};