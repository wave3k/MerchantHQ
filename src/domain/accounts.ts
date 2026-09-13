import type { Role } from "../types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function validateAccountPassword(
  role: Exclude<Role, "boss">,
  password: string,
): string | null {
  if (role === "manager" && password.length < 4) {
    return "Le compte Gérant doit avoir un code d’au moins 4 caractères.";
  }
  if (
    (role === "cashier" || role === "employee") &&
    password.length > 0 &&
    password.length < 4
  ) {
    return "Laissez le code vide ou utilisez au moins 4 caractères.";
  }
  return null;
}
