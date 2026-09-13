export type CalculatorOperator = "+" | "-" | "*" | "/";

const tokenPattern = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([+\-*/()]))/y;

export function evaluateExpression(expression: string): number {
  const tokens: Array<number | string> = [];
  let index = 0;
  const source = expression.replace(/,/g, ".");

  while (index < source.length) {
    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(source);
    if (!match) throw new Error("Expression invalide");
    tokens.push(match[1] ? Number(match[1]) : (match[2] ?? ""));
    index = tokenPattern.lastIndex;
  }
  if (!tokens.length) throw new Error("Expression vide");

  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];

  function parsePrimary(): number {
    const token = take();
    if (token === "(") {
      const value = parseAdditive();
      if (take() !== ")") throw new Error("Parenthèse manquante");
      return value;
    }
    if (token === "+") return parsePrimary();
    if (token === "-") return -parsePrimary();
    if (typeof token !== "number") throw new Error("Nombre attendu");
    return token;
  }

  function parseMultiplicative(): number {
    let value = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const operator = take();
      const right = parsePrimary();
      if (operator === "/" && right === 0) throw new Error("Division par zéro");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseAdditive(): number {
    let value = parseMultiplicative();
    while (peek() === "+" || peek() === "-") {
      const operator = take();
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseAdditive();
  if (cursor !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Expression invalide");
  }
  return result;
}

// Arrondi à 2 décimales pour éviter les artefacts de virgule flottante sur les
// montants (ex. 100 * 1.16 = 115.99999999999999).
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function percentageOf(value: number, percentage: number): number {
  return roundMoney((value * percentage) / 100);
}

export function withTax(value: number, taxRate: number): number {
  return roundMoney(value * (1 + taxRate / 100));
}

export function withDiscount(value: number, discountRate: number): number {
  return roundMoney(value * (1 - discountRate / 100));
}

export function marginRate(cost: number, salePrice: number): number {
  if (salePrice === 0) return 0;
  return roundMoney(((salePrice - cost) / salePrice) * 100);
}
