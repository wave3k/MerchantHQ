import type { SQLiteDatabase } from "expo-sqlite";

import { formatDateTime, formatMoney, initials } from "../domain/format";
import {
  createDefaultTicketLayout,
  parseTicketLayout,
  type TicketBlock,
  type TicketLayout,
} from "../domain/ticketLayout";
import { activeLanguage, t } from "../i18n";
import type { Order, PaymentMethod, User } from "../types";
import { getSetting, setSetting } from "./database";

export interface TicketItemData {
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface TicketEstablishment {
  shopName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  legalInfo: string;
  taxRate: number;
  openingHours: string;
}

export interface TicketDesignerData {
  layout: TicketLayout;
  autoPrint: boolean;
  establishment: TicketEstablishment;
  logoDataUri: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paymentLabel(method: PaymentMethod): string {
  if (method === "cash") return activeLanguage === "en" ? "Cash" : "Espèces";
  if (method === "card") return activeLanguage === "en" ? "Card" : "Carte";
  return "Mobile Money";
}

function labelled(label: string, value: string): string {
  if (!value) return "";
  return label
    ? `<span class="label">${escapeHtml(t(label))} :</span> ${escapeHtml(value)}`
    : escapeHtml(value);
}

export async function loadTicketDesigner(
  db: SQLiteDatabase,
): Promise<TicketDesignerData> {
  const [
    storedLayout,
    autoPrint,
    shopName,
    address,
    phone,
    email,
    website,
    legalInfo,
    taxRate,
    openingHours,
    legacyHeader,
    legacyFooter,
    logoDataUri,
  ] = await Promise.all([
    getSetting(db, "ticket_layout_v2"),
    getSetting(db, "ticket_auto_print"),
    getSetting(db, "shop_name"),
    getSetting(db, "shop_address"),
    getSetting(db, "shop_phone"),
    getSetting(db, "shop_email"),
    getSetting(db, "shop_website"),
    getSetting(db, "shop_legal_info"),
    getSetting(db, "tax_rate"),
    getSetting(db, "opening_hours"),
    getSetting(db, "ticket_header"),
    getSetting(db, "ticket_footer"),
    getSetting(db, "shop_logo"),
  ]);
  return {
    layout:
      parseTicketLayout(storedLayout) ??
      createDefaultTicketLayout({
        header: legacyHeader ?? "",
        footer: legacyFooter ?? "",
      }),
    autoPrint: autoPrint !== "0",
    logoDataUri: logoDataUri || null,
    establishment: {
      shopName: shopName ?? "Ma boutique",
      address: address ?? "",
      phone: phone ?? "",
      email: email ?? "",
      website: website ?? "",
      legalInfo: legalInfo ?? "",
      taxRate: Math.max(0, Number(taxRate) || 0),
      openingHours: openingHours ?? "",
    },
  };
}

export async function saveTicketDesigner(
  db: SQLiteDatabase,
  layout: TicketLayout,
  autoPrint: boolean,
  actor: User,
): Promise<void> {
  await setSetting(db, "ticket_layout_v2", JSON.stringify(layout), actor);
  await setSetting(db, "ticket_auto_print", autoPrint ? "1" : "0", actor);
}

function blockClass(block: TicketBlock): string {
  return [
    "block",
    `align-${block.alignment}`,
    `size-${block.fontSize}`,
    `before-${block.spacingBefore}`,
    `after-${block.spacingAfter}`,
    block.bold ? "bold" : "",
    block.uppercase ? "uppercase" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderBlock(
  block: TicketBlock,
  order: Order,
  items: TicketItemData[],
  establishment: TicketEstablishment,
  layout: TicketLayout,
  logoDataUri: string | null,
): string {
  if (!block.enabled) return "";
  const className = blockClass(block);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const taxAmount =
    establishment.taxRate > 0
      ? Math.round(
          order.total - order.total / (1 + establishment.taxRate / 100),
        )
      : 0;

  switch (block.type) {
    case "logo":
      if (logoDataUri) {
        return `<div class="${className}"><img class="logo-image" src="${escapeHtml(
          logoDataUri,
        )}" alt="Commerce Manager" /></div>`;
      }
      return `<div class="${className}"><div class="logo">${escapeHtml(
        initials(establishment.shopName) || "CM",
      )}</div></div>`;
    case "shop_name":
      return `<div class="${className}">${escapeHtml(establishment.shopName)}</div>`;
    case "custom_text":
    case "footer":
      return block.text
        ? `<div class="${className} preserve">${escapeHtml(block.text)}</div>`
        : "";
    case "address":
      return establishment.address
        ? `<div class="${className}">${labelled(block.label, establishment.address)}</div>`
        : "";
    case "phone":
      return establishment.phone
        ? `<div class="${className}">${labelled(block.label, establishment.phone)}</div>`
        : "";
    case "email":
      return establishment.email
        ? `<div class="${className}">${labelled(block.label, establishment.email)}</div>`
        : "";
    case "website":
      return establishment.website
        ? `<div class="${className}">${labelled(block.label, establishment.website)}</div>`
        : "";
    case "legal_info":
      return establishment.legalInfo
        ? `<div class="${className}">${labelled(block.label, establishment.legalInfo)}</div>`
        : "";
    case "tax_info":
      return `<div class="${className}">${labelled(
        block.label,
        `${establishment.taxRate} %`,
      )}</div>`;
    case "opening_hours":
      return establishment.openingHours
        ? `<div class="${className}">${labelled(
            block.label,
            establishment.openingHours,
          )}</div>`
        : "";
    case "separator":
      return `<div class="${className}"><div class="separator separator-${block.separatorStyle}"></div></div>`;
    case "order_number":
      return `<div class="${className}">${labelled(block.label, order.order_number)}</div>`;
    case "date":
      return `<div class="${className}">${labelled(
        block.label,
        formatDateTime(order.created_at),
      )}</div>`;
    case "client":
      return `<div class="${className}">${labelled(
        block.label,
        order.client_name ??
          (activeLanguage === "en" ? "Walk-in customer" : "Client de passage"),
      )}</div>`;
    case "employee":
      return `<div class="${className}">${labelled(
        block.label,
        order.employee_name ?? order.user_name,
      )}</div>`;
    case "cashier":
      return `<div class="${className}">${labelled(block.label, order.user_name)}</div>`;
    case "payment":
      return `<div class="${className}">${labelled(
        block.label,
        paymentLabel(order.payment_method),
      )}</div>`;
    case "items":
      return `<div class="${className}">
        ${block.label ? `<div class="items-title">${escapeHtml(t(block.label))}</div>` : ""}
        <table>${items
          .map(
            (item) => `<tr>
              <td>
                <strong>${escapeHtml(item.product_name)}</strong>
                ${
                  layout.itemDetails
                    ? `<small>${item.quantity} × ${escapeHtml(formatMoney(item.unit_price))}</small>`
                    : ""
                }
              </td>
              <td class="right">${escapeHtml(formatMoney(item.subtotal))}</td>
            </tr>`,
          )
          .join("")}</table>
      </div>`;
    case "item_count":
      return `<div class="${className}">${labelled(block.label, String(itemCount))}</div>`;
    case "tax_total":
      return taxAmount > 0 || layout.showTaxWhenZero
        ? `<div class="${className} row"><span>${escapeHtml(t(block.label))}${
            establishment.taxRate > 0 ? ` (${establishment.taxRate} %)` : ""
          }</span><strong>${escapeHtml(formatMoney(taxAmount))}</strong></div>`
        : "";
    case "total":
      return `<div class="${className} row total"><span>${escapeHtml(
        t(block.label || "TOTAL"),
      )}</span><strong>${escapeHtml(formatMoney(order.total))}</strong></div>`;
  }
}

export function buildDesignedTicketHtml(
  order: Order,
  items: TicketItemData[],
  data: TicketDesignerData,
): string {
  const density = data.layout.density === "compact" ? "3px" : "5px";
  const rendered = data.layout.blocks
    .map((block) =>
      renderBlock(
        block,
        order,
        items,
        data.establishment,
        data.layout,
        data.logoDataUri,
      ),
    )
    .join("");

  return `<!doctype html>
<html lang="${activeLanguage}">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: ${data.layout.paperWidth}mm auto; margin: ${data.layout.marginMm}mm; }
      * { box-sizing: border-box; }
      body {
        color: #1f1720;
        font-family: Arial, sans-serif;
        font-size: 11px;
        line-height: 1.35;
        margin: 0;
        width: 100%;
      }
      .block { display: block; }
      .align-left { text-align: left; }
      .align-center { text-align: center; }
      .align-right { text-align: right; }
      .size-small { font-size: 9px; }
      .size-normal { font-size: 11px; }
      .size-large { font-size: 15px; }
      .size-xlarge { font-size: 19px; }
      .bold { font-weight: 700; }
      .uppercase { text-transform: uppercase; }
      .before-none { margin-top: 0; }
      .before-small { margin-top: ${density}; }
      .before-normal { margin-top: calc(${density} * 2); }
      .before-large { margin-top: calc(${density} * 3); }
      .after-none { margin-bottom: 0; }
      .after-small { margin-bottom: ${density}; }
      .after-normal { margin-bottom: calc(${density} * 2); }
      .after-large { margin-bottom: calc(${density} * 3); }
      .preserve { white-space: pre-wrap; }
      .label, small { color: #655761; }
      .logo {
        align-items: center;
        border: 1.5px solid #1f1720;
        border-radius: 8px;
        display: inline-flex;
        font-size: 15px;
        font-weight: 700;
        height: 34px;
        justify-content: center;
        width: 34px;
      }
      .logo-image {
        display: inline-block;
        height: auto;
        max-width: 100%;
        object-fit: contain;
        width: 28mm;
      }
      .separator { border-top-width: 1px; margin: 4px 0; }
      .separator-dashed { border-top-style: dashed; }
      .separator-solid { border-top-style: solid; }
      .separator-double { border-top: 3px double #1f1720; }
      table { border-collapse: collapse; width: 100%; }
      td { padding: ${density} 0; vertical-align: top; }
      td.right { font-weight: 700; text-align: right; white-space: nowrap; }
      small { display: block; margin-top: 1px; }
      .items-title { font-weight: 700; margin-bottom: 2px; }
      .row { align-items: baseline; display: flex; justify-content: space-between; gap: 8px; }
      .total { font-size: inherit; }
    </style>
  </head>
  <body>${rendered}</body>
</html>`;
}
