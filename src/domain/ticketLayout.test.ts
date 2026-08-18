import { expect, test } from "bun:test";

import {
  createDefaultTicketLayout,
  createTicketBlock,
  moveTicketBlock,
  parseTicketLayout,
} from "./ticketLayout";

test("le ticket par défaut contient les informations essentielles", () => {
  const layout = createDefaultTicketLayout();
  expect(layout.blocks.some((block) => block.type === "shop_name")).toBe(true);
  expect(layout.blocks.some((block) => block.type === "items")).toBe(true);
  expect(layout.blocks.some((block) => block.type === "total")).toBe(true);
});

test("un bloc peut être déplacé sans modifier la liste originale", () => {
  const blocks = [
    createTicketBlock("shop_name"),
    createTicketBlock("items"),
    createTicketBlock("total"),
  ];
  const moved = moveTicketBlock(blocks, 0, 2);
  expect(moved[2]?.type).toBe("shop_name");
  expect(blocks[0]?.type).toBe("shop_name");
});

test("une mise en page invalide est ignorée", () => {
  expect(parseTicketLayout('{"version":1,"blocks":[]}')).toBe(null);
  expect(
    parseTicketLayout('{"version":2,"blocks":[{"id":"x","type":"total"}]}'),
  ).toBe(null);
});

test("une mise en page complète peut être sauvegardée puis relue", () => {
  const layout = createDefaultTicketLayout();
  const restored = parseTicketLayout(JSON.stringify(layout));
  expect(restored?.paperWidth).toBe(80);
  expect(restored?.blocks.length).toBe(layout.blocks.length);
  expect(restored?.blocks[0]?.type).toBe("logo");
});
