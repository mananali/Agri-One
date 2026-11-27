import type { CatalogCategory, Product } from "./api";

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const sampleListings = [
  ["urea-46", "urea-fertilizer-46", "Urea Fertilizer 46% N", "OmniFert", "Fertilizers", "45 kg", "bag", 266, 280, "Nitrogen fertilizer for healthy crop growth."],
  ["tomato-seeds", "hybrid-tomato-seeds", "Hybrid Tomato Seeds", "Indo-American Seeds", "Seeds", "10 g", "packet", 350, 390, "Hybrid seeds selected for strong germination and uniform fruit."],
  ["hamla-550", "katyayani-trance", "Hamla 550 Insecticide", "Gharda", "Pesticides", "500 ml", "bottle", 720, 780, "Crop pest management product. Follow all label instructions."],
  ["dap-18", "dap-fertilizer-18-46", "DAP Fertilizer 18:46:0", "SABIC", "Fertilizers", "50 kg", "bag", 1350, 1450, "Phosphorus and nitrogen nutrition for early crop development."],
  ["brinjal-seeds", "hybrid-brinjal-seeds", "Hybrid Brinjal Seeds", "Mahyco", "Seeds", "10 g", "packet", 300, 340, "Hybrid brinjal seed selected for healthy plants and harvests."],
  ["chilli-seeds", "hybrid-chilli-seeds", "Hybrid Chilli Seeds", "Mahyco", "Seeds", "10 g", "packet", 540, 590, "Hybrid chilli variety for productive cultivation."],
  ["neem-care", "neem-crop-care", "Neem Crop Care", "T. Stanes", "Organic Products", "1 litre", "bottle", 490, 550, "Plant-based crop care. Read label directions before use."],
  ["sprayer-kit", "farm-sprayer-kit", "Farm Sprayer Kit", "AgriPro", "Equipment", "1", "set", 1890, 2200, "Practical equipment for everyday crop care."],
  ["yara-npk", "yaramila-npk-102424", "YaraMila NPK 10:24:24", "Yara", "Fertilizers", "25 kg", "bag", 1240, 1390, "Balanced granular crop nutrition for healthy roots."],
  ["mavuno", "mavuno-field-fertilizer", "Mavuno Field Fertilizer", "Mavuno", "Fertilizers", "50 kg", "bag", 1190, 1320, "Field fertilizer for seasonal crop nutrition."],
  ["granular-urea", "granular-urea-5kg", "Granular Urea Fertilizer", "AgriGrow", "Fertilizers", "5 kg", "bag", 420, 480, "Easy-to-handle granular urea for small farms."],
  ["cucumber-seeds", "hybrid-cucumber-seeds", "Hybrid Cucumber Seeds", "East-West Seed", "Seeds", "10 g", "packet", 280, 320, "Hybrid cucumber seed selected for vigorous vines."],
  ["okra-seeds", "hybrid-okra-seeds", "Hybrid Okra Seeds", "Namdhari Seeds", "Seeds", "10 g", "packet", 320, 360, "Hybrid okra seeds for productive plants."],
  ["filban", "filban-insecticide-20ec", "Filban Insecticide 20% EC", "Agrofil", "Pesticides", "500 ml", "bottle", 280, 320, "Crop protection product. Follow label guidance."],
  ["hamla-1l", "hamla-insecticide-1l", "Hamla 550 Insecticide 1 L", "Gharda", "Pesticides", "1 litre", "bottle", 980, 1120, "Crop pest management product with label safety directions."],
  ["spray-care", "crop-spray-protection", "Crop Spray Protection", "AgriCare", "Pesticides", "Field", "application", 650, 720, "Crop protection product. Seek local agricultural advice."],
] as const;

export const demoProducts: Product[] = sampleListings.map((item, index) => {
  const [id, slug, name, brandName, categoryName, packSize, unit, price, mrp, description] = item;
  const category = toSlug(categoryName);
  return {
    id: `demo-product-${id}`,
    slug,
    name,
    description,
    packSize,
    unit,
    category: { name: categoryName, slug: category },
    brand: { name: brandName },
    imageUrl: null,
    offers: [{
      id: `demo-offer-${id}`,
      price,
      mrp,
      availableStock: 25 + (index % 7) * 5,
      minimumOrderQuantity: 1,
      seller: { name: "Agri-One sample listing" },
    }],
  };
});

export const demoCategories: CatalogCategory[] = Array.from(
  new Map(demoProducts.map(product => [product.category.slug, product.category])).values(),
).map(category => ({ id: `demo-${category.slug}`, ...category }));
