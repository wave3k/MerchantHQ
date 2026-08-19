import type { ComponentType } from "react";
import { VenteCashIcon } from "./VenteCashIcon";
import { VenteCashDetailIcon } from "./VenteCashDetailIcon";
import { VenteCashMinimalIcon } from "./VenteCashMinimalIcon";
import { VenteCashReceiptIcon } from "./VenteCashReceiptIcon";
import { VenteCashBillIcon } from "./VenteCashBillIcon";
import { VenteCashBronzeIcon } from "./VenteCashBronzeIcon";
import { StockLogistiqueIcon } from "./StockLogistiqueIcon";
import { StockLogistiqueDetailIcon } from "./StockLogistiqueDetailIcon";
import { StockLogistiquePaletteIcon } from "./StockLogistiquePaletteIcon";
import { StockLogistiqueTruckIcon } from "./StockLogistiqueTruckIcon";
import { StockLogistiqueBarcodeIcon } from "./StockLogistiqueBarcodeIcon";
import { QgHubIcon } from "./QgHubIcon";
import { QgHubDetailIcon } from "./QgHubDetailIcon";
import { QgHubPinIcon } from "./QgHubPinIcon";
import { QgHubShieldIcon } from "./QgHubShieldIcon";
import { QgHubStarIcon } from "./QgHubStarIcon";
import { MerchanthqCombinedIcon } from "./MerchanthqCombinedIcon";
import { MerchanthqEmblemIcon } from "./MerchanthqEmblemIcon";

export interface LogoProps {
  size?: number;
  color?: string;
  detail?: string;
  accessibilityLabel?: string;
}

export type LogoName = string;

export const logoRegistry: Record<LogoName, ComponentType<LogoProps>> = {
  "vente-cash": VenteCashIcon,
  "vente-cash-detail": VenteCashDetailIcon,
  "vente-cash-minimal": VenteCashMinimalIcon,
  "vente-cash-receipt": VenteCashReceiptIcon,
  "vente-cash-bill": VenteCashBillIcon,
  "vente-cash-bronze": VenteCashBronzeIcon,
  "stock-logistique": StockLogistiqueIcon,
  "stock-logistique-detail": StockLogistiqueDetailIcon,
  "stock-logistique-palette": StockLogistiquePaletteIcon,
  "stock-logistique-truck": StockLogistiqueTruckIcon,
  "stock-logistique-barcode": StockLogistiqueBarcodeIcon,
  "qg-hub": QgHubIcon,
  "qg-hub-detail": QgHubDetailIcon,
  "qg-hub-pin": QgHubPinIcon,
  "qg-hub-shield": QgHubShieldIcon,
  "qg-hub-star": QgHubStarIcon,
  "merchanthq-combined": MerchanthqCombinedIcon,
  "merchanthq-emblem": MerchanthqEmblemIcon,
};

export const logoLabels: Record<LogoName, string> = {
  "vente-cash": "Vente Cash",
  "vente-cash-detail": "Vente Cash D\u00e9taill\u00e9",
  "vente-cash-minimal": "Vente Cash Minimale",
  "vente-cash-receipt": "Vente Cash Re\u00e7u",
  "vente-cash-bill": "Vente Cash Billet",
  "vente-cash-bronze": "Vente Cash Bronze",
  "stock-logistique": "Stock Logistique",
  "stock-logistique-detail": "Stock D\u00e9taill\u00e9",
  "stock-logistique-palette": "Stock Palette",
  "stock-logistique-truck": "Stock Camion",
  "stock-logistique-barcode": "Stock Code-barres",
  "qg-hub": "QG Hub",
  "qg-hub-detail": "QG Hub R\u00e9seau",
  "qg-hub-pin": "QG Hub Localisation",
  "qg-hub-shield": "QG Hub Bouclier",
  "qg-hub-star": "QG Hub \u00c9toile",
  "merchanthq-combined": "MerchantHQ Combin\u00e9",
  "merchanthq-emblem": "MerchantHQ Embl\u00e8me",
};

export const logoCategories = [
  { title: "Vente Cash", logos: ["vente-cash", "vente-cash-detail", "vente-cash-minimal", "vente-cash-receipt", "vente-cash-bill", "vente-cash-bronze"] },
  { title: "Stock Logistique", logos: ["stock-logistique", "stock-logistique-detail", "stock-logistique-palette", "stock-logistique-truck", "stock-logistique-barcode"] },
  { title: "QG / Hub", logos: ["qg-hub", "qg-hub-detail", "qg-hub-pin", "qg-hub-shield", "qg-hub-star"] },
  { title: "MerchantHQ", logos: ["merchanthq-combined", "merchanthq-emblem"] },
];
