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

interface VerifyEmailProps {
  code: string;
  shopName: string;
}

const PRIMARY = "#1D55C5";
const INK = "#111827";
const MUTED = "#6B7280";

export function VerifyEmail({ code, shopName }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Votre code de vérification MerchantHQ</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>MerchantHQ</Text>
          <Heading style={title}>Confirmez votre adresse e-mail</Heading>
          <Text style={paragraph}>
            Bonjour{shopName ? `, pour « ${shopName} »` : ""}. Voici votre code
            de vérification :
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>
          <Text style={paragraph}>
            Ce code expire dans 15 minutes. Si vous ne l’utilisez pas, vous
            pourrez en demander un nouveau depuis l’application.
          </Text>
          <Text style={paragraph}>
            Une petite question : répondez-moi simplement OUI si vous avez bien
            reçu ce message.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Si vous n’avez pas créé ce compte, vous pouvez ignorer cet e-mail.
            MerchantHQ — votre boutique, toutes vos tablettes.
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

const codeBox = {
  backgroundColor: "#F3F4F6",
  borderRadius: "8px",
  margin: "16px 0",
  padding: "18px",
  textAlign: "center" as const,
};

const codeText = {
  color: PRIMARY,
  fontSize: "34px",
  fontWeight: 700,
  letterSpacing: "10px",
  margin: 0,
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