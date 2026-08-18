import * as Print from "expo-print";
import type { SQLiteDatabase } from "expo-sqlite";

import type { Order } from "../types";
import { getSetting } from "./database";
import {
  buildDesignedTicketHtml,
  loadTicketDesigner,
} from "./ticketDesigner";

interface TicketItem {
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export async function isAutoPrintEnabled(db: SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, "ticket_auto_print")) !== "0";
}

export async function printOrderTicket(
  db: SQLiteDatabase,
  orderId: number,
): Promise<void> {
  const order = await db.getFirstAsync<Order>(
    `SELECT o.*, c.name AS client_name, u.name AS user_name,
      COALESCE(o.employee_name, e.name) AS employee_name,
      (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o
     LEFT JOIN clients c ON c.id = o.client_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN employees e ON e.id = o.employee_id
     WHERE o.id = ?`,
    orderId,
  );
  if (!order) throw new Error("La vente est introuvable.");
  const [items, design] = await Promise.all([
    db.getAllAsync<TicketItem>(
      `SELECT product_name, unit_price, quantity, subtotal
       FROM order_items WHERE order_id = ? ORDER BY id`,
      orderId,
    ),
    loadTicketDesigner(db),
  ]);
  await Print.printAsync({
    html: buildDesignedTicketHtml(order, items, design),
  });
}

export async function printSampleTicket(
  db: SQLiteDatabase,
  designOverride?: Awaited<ReturnType<typeof loadTicketDesigner>>,
): Promise<void> {
  const design = designOverride ?? (await loadTicketDesigner(db));
  const sample: Order = {
    id: 0,
    order_number: "APERÇU-001",
    client_id: null,
    client_name: "Client de passage",
    user_id: 0,
    user_name: "Propriétaire",
    employee_id: null,
    employee_name: "Employé",
    total: 5600,
    payment_method: "card",
    status: "paid",
    created_at: new Date().toISOString(),
    item_count: 2,
  };
  await Print.printAsync({
    html: buildDesignedTicketHtml(
      sample,
      [
        {
          product_name: "Produit exemple",
          unit_price: 2800,
          quantity: 2,
          subtotal: 5600,
        },
      ],
      design,
    ),
  });
}
