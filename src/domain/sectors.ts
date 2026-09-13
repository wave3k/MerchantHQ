export const BUSINESS_SECTORS = [
  "Alimentation & épicerie",
  "Boucherie & poissonnerie",
  "Boulangerie & pâtisserie",
  "Restauration & café",
  "Quincaillerie",
  "Matériaux de construction",
  "Vêtements & mode",
  "Chaussures",
  "Cosmétiques & parfumerie",
  "Pharmacie & santé",
  "Électronique & électroménager",
  "Téléphonie & accessoires",
  "Informatique",
  "Mobilier & décoration",
  "Papeterie & librairie",
  "Bijouterie",
  "Optique",
  "Fleuriste",
  "Marché & bazar",
  "Agro-alimentaire & élevage",
  "Agriculture",
  "Import-export",
  "Grossiste & distribution",
  "Transport & taxi",
  "Garage & mécanique",
  "Atelier de couture",
  "Salon de coiffure & beauté",
  "Plomberie & électricité",
  "Immobilier",
  "Agency de voyage",
  "Sport & loisirs",
  "Jouets & puériculture",
  "Articles ménagers",
  "Autre",
] as const;

export const CUSTOM_SECTOR = "__custom__";

export function sectorLabel(sector: string | null | undefined): string {
  if (!sector) return "Non renseigné";
  if (sector === CUSTOM_SECTOR) return "Autre";
  return sector;
}