export type CatalogSourceCurrency = "USD" | "EUR";

export interface CommerceCatalogItem {
  name: string;
  category: string;
  price: number;
  sourceCurrency: CatalogSourceCurrency;
}

const usd = (
  name: string,
  category: string,
  price: number,
): CommerceCatalogItem => ({
  name,
  category,
  price,
  sourceCurrency: "USD",
});

export const COMMERCE_CATALOG: readonly CommerceCatalogItem[] = [
  usd("Maquillage nude", "Maquillage", 25),
  usd("Maquillage soft glam", "Maquillage", 35),
  usd("Maquillage glam", "Maquillage", 30),
  usd("Maquillage événementiel", "Maquillage", 40),
  usd("Maquillage artistique", "Maquillage", 45),
  usd("Faux cils", "Maquillage", 5),

  usd("Cils à cils", "Extensions de cils", 60),
  usd("Retouche cils à cils", "Extensions de cils", 45),
  usd("Volume", "Extensions de cils", 75),
  usd("Retouche volume", "Extensions de cils", 55),
  usd("Volume russe", "Extensions de cils", 90),
  usd("Pose personnalisée", "Extensions de cils", 90),
  usd("Retouche après 3 semaines", "Extensions de cils", 60),
  usd("Cils du bas", "Extensions de cils", 15),
  usd("Whispy volume", "Extensions de cils", 100),
  usd("Retouche Whispy volume", "Extensions de cils", 75),
  usd("Shampoing des cils", "Extensions de cils", 30),
  usd("Dépose des extensions", "Extensions de cils", 30),

  usd("Ponytail classique", "Ponytail", 35),
  usd("Ponytail sophistiqué", "Ponytail", 50),
  usd("Frontale Ponytail", "Ponytail", 60),

  usd("Balayage cheveux", "Coloration", 80),
  usd("Balayage perruque", "Coloration", 100),
  usd("Décoloration intégrale", "Coloration", 40),
  usd("Autre couleur de coloration", "Coloration", 60),

  usd("Blanchiment dentaire – 1 séance", "Blanchiment dentaire", 70),
  usd("Blanchiment dentaire – 2e séance", "Blanchiment dentaire", 60),
  usd("Blanchiment dentaire – 3e séance", "Blanchiment dentaire", 50),
  usd(
    "Supplément service à domicile (par heure)",
    "Service à domicile",
    10,
  ),

  usd("Défrisage avec produit du salon", "Soins et coiffage", 30),
  usd("Défrisage avec produit du client", "Soins et coiffage", 20),
  usd("Shampoing", "Soins et coiffage", 10),
  usd("Shampoing + Bigoudis", "Soins et coiffage", 25),
  usd("Shampoing + Brushing", "Soins et coiffage", 20),
  usd("Shampoing + Boucles", "Soins et coiffage", 30),
  usd("Bain d’huile", "Soins et coiffage", 30),
  usd("Natte collée – tarif 5 $", "Soins et coiffage", 5),
  usd("Natte collée – tarif 10 $", "Soins et coiffage", 10),
  usd("Défaire les tresses – tarif 5 $", "Soins et coiffage", 5),
  usd("Défaire les tresses – tarif 10 $", "Soins et coiffage", 10),
  usd("Défaire les tresses – tarif 15 $", "Soins et coiffage", 15),

  usd("Brushing", "Styling", 10),
  usd("Brushing + Lissage", "Styling", 20),
  usd("Brushing + Boucles", "Styling", 30),
  usd("Boucles", "Styling", 20),
  usd("Coupe", "Styling", 5),
  usd("Customisation + Décoloration", "Styling", 15),

  usd("Tissage ouvert", "Tissage", 35),
  usd("Tissage fermé", "Tissage", 50),
  usd("Tissage closure", "Tissage", 40),
  usd("Tissage closure + Customisation", "Tissage", 50),
  usd("Tissage Flip over – tarif 40 $", "Tissage", 40),
  usd("Tissage Flip over – tarif 50 $", "Tissage", 50),
  usd("Tissage middle part", "Tissage", 50),
  usd("Tissage deux raies", "Tissage", 50),
  usd("Tissage lace frontale", "Tissage", 60),

  usd("Pose classique lace frontale", "Pose perruque", 50),
  usd("Pose classique closure", "Pose perruque", 40),
  usd("Pose Pro", "Pose perruque", 60),
  usd("Pose sans colle – tarif 35 $", "Pose perruque", 35),
  usd("Pose sans colle – tarif 40 $", "Pose perruque", 40),
  {
    name: "Perruque coupe – tarif 50 €",
    category: "Pose perruque",
    price: 50,
    sourceCurrency: "EUR",
  },
];

export function catalogPriceForPrimaryCurrency(
  item: CommerceCatalogItem,
  primaryCurrency: string,
  configuredRate: number,
): number {
  if (primaryCurrency === item.sourceCurrency) return item.price;
  if (primaryCurrency === "CDF") {
    const rate =
      Number.isFinite(configuredRate) && configuredRate > 0
        ? configuredRate
        : 2800;
    return Math.round(item.price * rate);
  }
  return item.price;
}
