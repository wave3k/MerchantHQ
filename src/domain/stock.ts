import type { Product } from "../types";

type StockState = Pick<Product, "low_stock_threshold" | "stock" | "tracks_stock">;

export function tracksStock(product: StockState): boolean {
  return Boolean(product.tracks_stock);
}

export function isOutOfStock(product: StockState): boolean {
  return tracksStock(product) && product.stock <= 0;
}

export function isLowStock(product: StockState): boolean {
  return tracksStock(product) && product.stock <= product.low_stock_threshold;
}

export function maximumSaleQuantity(product: StockState): number {
  return tracksStock(product) ? product.stock : Number.MAX_SAFE_INTEGER;
}
