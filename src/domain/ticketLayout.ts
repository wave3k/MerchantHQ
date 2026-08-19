import type { IconName } from "../components/Icon";

/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/* Hallmark · macrostructure: Component Playground · tone: utilitaire · anchor hue: framboise */

export type TicketBlockType =
  | "logo"
  | "shop_name"
  | "custom_text"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "legal_info"
  | "tax_info"
  | "opening_hours"
  | "separator"
  | "order_number"
  | "date"
  | "client"
  | "employee"
  | "cashier"
  | "payment"
  | "items"
  | "item_count"
  | "tax_total"
  | "total"
  | "footer";

export type TicketAlignment = "left" | "center" | "right";
export type TicketFontSize = "small" | "normal" | "large" | "xlarge";
export type TicketSpacing = "none" | "small" | "normal" | "large";
export type TicketSeparatorStyle = "dashed" | "solid" | "double";

export interface TicketBlock {
  id: string;
  type: TicketBlockType;
  enabled: boolean;
  label: string;
  text: string;
  alignment: TicketAlignment;
  fontSize: TicketFontSize;
  bold: boolean;
  uppercase: boolean;
  spacingBefore: TicketSpacing;
  spacingAfter: TicketSpacing;
  separatorStyle: TicketSeparatorStyle;
}

export interface TicketLayout {
  version: 2;
  paperWidth: 58 | 80;
  marginMm: 3 | 5 | 7;
  density: "compact" | "comfortable";
  itemDetails: boolean;
  showTaxWhenZero: boolean;
  blocks: TicketBlock[];
}

export interface TicketBlockDefinition {
  type: TicketBlockType;
  title: string;
  description: string;
  icon: IconName;
  allowMultiple?: boolean;
}

export const ticketBlockDefinitions: TicketBlockDefinition[] = [
  {
    type: "logo",
    title: "Logo",
    description: "Logo officiel de MerchantHQ.",
    icon: "Image",
  },
  {
    type: "shop_name",
    title: "Nom de la boutique",
    description: "Nom défini dans les informations de l’établissement.",
    icon: "Text",
  },
  {
    type: "custom_text",
    title: "Texte libre",
    description: "Message, slogan, conditions ou information personnalisée.",
    icon: "Type",
    allowMultiple: true,
  },
  {
    type: "address",
    title: "Adresse",
    description: "Adresse de l’établissement.",
    icon: "MapPin",
  },
  {
    type: "phone",
    title: "Téléphone",
    description: "Numéro de téléphone de l’établissement.",
    icon: "Phone",
  },
  {
    type: "email",
    title: "E-mail",
    description: "Adresse e-mail de l’établissement.",
    icon: "Mail",
  },
  {
    type: "website",
    title: "Site internet",
    description: "Site ou page publique de l’établissement.",
    icon: "Globe",
  },
  {
    type: "legal_info",
    title: "Identifiant légal",
    description: "RCCM, numéro fiscal ou autre référence légale.",
    icon: "Scale",
  },
  {
    type: "tax_info",
    title: "Taux de taxe",
    description: "Taux configuré dans les réglages.",
    icon: "Percent",
  },
  {
    type: "opening_hours",
    title: "Horaires",
    description: "Horaires d’ouverture de l’établissement.",
    icon: "Clock",
  },
  {
    type: "separator",
    title: "Séparateur",
    description: "Ligne pointillée, continue ou double.",
    icon: "Minus",
    allowMultiple: true,
  },
  {
    type: "order_number",
    title: "Numéro de vente",
    description: "Référence unique de la vente.",
    icon: "Receipt",
  },
  {
    type: "date",
    title: "Date et heure",
    description: "Moment exact de l’encaissement.",
    icon: "CalendarDays",
  },
  {
    type: "client",
    title: "Client",
    description: "Nom du client ou client de passage.",
    icon: "User",
  },
  {
    type: "employee",
    title: "Employé",
    description: "Personne à qui la vente est attribuée.",
    icon: "IdCard",
  },
  {
    type: "cashier",
    title: "Compte de caisse",
    description: "Compte ayant enregistré la vente.",
    icon: "Key",
  },
  {
    type: "payment",
    title: "Paiement",
    description: "Espèces, Mobile Money ou carte.",
    icon: "CreditCard",
  },
  {
    type: "items",
    title: "Articles",
    description: "Produits, quantités, prix unitaires et sous-totaux.",
    icon: "List",
  },
  {
    type: "item_count",
    title: "Nombre d’articles",
    description: "Nombre total d’unités vendues.",
    icon: "Calculator",
  },
  {
    type: "tax_total",
    title: "Montant de la taxe",
    description: "Part de taxe incluse dans le total.",
    icon: "ReceiptText",
  },
  {
    type: "total",
    title: "Total",
    description: "Montant final payé.",
    icon: "Banknote",
  },
  {
    type: "footer",
    title: "Message de fin",
    description: "Remerciement ou information après le total.",
    icon: "MessageSquare",
  },
];

const defaultLabels: Record<TicketBlockType, string> = {
  logo: "",
  shop_name: "",
  custom_text: "",
  address: "Adresse",
  phone: "Téléphone",
  email: "E-mail",
  website: "Site",
  legal_info: "Identifiant",
  tax_info: "Taux de taxe",
  opening_hours: "Horaires",
  separator: "",
  order_number: "Vente",
  date: "Date",
  client: "Client",
  employee: "Traité par",
  cashier: "Compte",
  payment: "Paiement",
  items: "Articles",
  item_count: "Nombre d’articles",
  tax_total: "Dont taxe",
  total: "TOTAL",
  footer: "",
};

let blockCounter = 0;

export function createTicketBlock(
  type: TicketBlockType,
  overrides: Partial<TicketBlock> = {},
): TicketBlock {
  blockCounter += 1;
  const centerTypes: TicketBlockType[] = [
    "logo",
    "shop_name",
    "custom_text",
    "footer",
  ];
  const largeTypes: TicketBlockType[] = ["shop_name", "total"];
  return {
    id: `ticket-${type}-${Date.now()}-${blockCounter}`,
    type,
    enabled: true,
    label: defaultLabels[type],
    text:
      type === "custom_text"
        ? "Votre message"
        : type === "footer"
          ? "Merci pour votre visite."
          : "",
    alignment: centerTypes.includes(type) ? "center" : "left",
    fontSize: largeTypes.includes(type) ? "large" : "normal",
    bold: type === "shop_name" || type === "order_number" || type === "total",
    uppercase: type === "total",
    spacingBefore: type === "total" || type === "footer" ? "normal" : "small",
    spacingAfter: type === "shop_name" ? "small" : "none",
    separatorStyle: "dashed",
    ...overrides,
  };
}

export function createDefaultTicketLayout(values?: {
  header?: string;
  footer?: string;
}): TicketLayout {
  const blocks: TicketBlock[] = [
    createTicketBlock("logo"),
    createTicketBlock("shop_name"),
    createTicketBlock("address", { alignment: "center", fontSize: "small" }),
    createTicketBlock("phone", { alignment: "center", fontSize: "small" }),
  ];
  if (values?.header?.trim()) {
    blocks.push(
      createTicketBlock("custom_text", {
        text: values.header.trim(),
        alignment: "center",
      }),
    );
  }
  blocks.push(
    createTicketBlock("separator"),
    createTicketBlock("order_number"),
    createTicketBlock("date", { fontSize: "small" }),
    createTicketBlock("client"),
    createTicketBlock("employee"),
    createTicketBlock("payment"),
    createTicketBlock("separator"),
    createTicketBlock("items"),
    createTicketBlock("tax_total"),
    createTicketBlock("total", {
      alignment: "right",
      fontSize: "xlarge",
    }),
    createTicketBlock("footer", {
      text: values?.footer?.trim() || "Merci pour votre visite.",
      alignment: "center",
      fontSize: "small",
    }),
  );
  return {
    version: 2,
    paperWidth: 80,
    marginMm: 5,
    density: "comfortable",
    itemDetails: true,
    showTaxWhenZero: false,
    blocks,
  };
}

export function moveTicketBlock(
  blocks: TicketBlock[],
  from: number,
  to: number,
): TicketBlock[] {
  if (
    from < 0 ||
    from >= blocks.length ||
    to < 0 ||
    to >= blocks.length ||
    from === to
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  if (!moved) return blocks;
  next.splice(to, 0, moved);
  return next;
}

function isTicketBlock(value: unknown): value is TicketBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Partial<TicketBlock>;
  return (
    typeof block.id === "string" &&
    ticketBlockDefinitions.some((definition) => definition.type === block.type) &&
    typeof block.enabled === "boolean" &&
    typeof block.label === "string" &&
    typeof block.text === "string" &&
    (block.alignment === "left" ||
      block.alignment === "center" ||
      block.alignment === "right") &&
    (block.fontSize === "small" ||
      block.fontSize === "normal" ||
      block.fontSize === "large" ||
      block.fontSize === "xlarge") &&
    typeof block.bold === "boolean" &&
    typeof block.uppercase === "boolean" &&
    (block.spacingBefore === "none" ||
      block.spacingBefore === "small" ||
      block.spacingBefore === "normal" ||
      block.spacingBefore === "large") &&
    (block.spacingAfter === "none" ||
      block.spacingAfter === "small" ||
      block.spacingAfter === "normal" ||
      block.spacingAfter === "large") &&
    (block.separatorStyle === "dashed" ||
      block.separatorStyle === "solid" ||
      block.separatorStyle === "double")
  );
}

function normalizeTicketBlock(block: TicketBlock): TicketBlock {
  return createTicketBlock(block.type, block);
}

export function parseTicketLayout(value: string | null): TicketLayout | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<TicketLayout>;
    if (
      parsed.version !== 2 ||
      !Array.isArray(parsed.blocks) ||
      !parsed.blocks.every(isTicketBlock)
    ) {
      return null;
    }
    return {
      version: 2,
      paperWidth: parsed.paperWidth === 58 ? 58 : 80,
      marginMm:
        parsed.marginMm === 3 || parsed.marginMm === 7 ? parsed.marginMm : 5,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      itemDetails: parsed.itemDetails !== false,
      showTaxWhenZero: parsed.showTaxWhenZero === true,
      blocks: parsed.blocks.map(normalizeTicketBlock),
    };
  } catch {
    return null;
  }
}
