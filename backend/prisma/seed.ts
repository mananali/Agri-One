import 'dotenv/config';
import { FulfillmentSource, OrganizationType, PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();
const categories = [
  ['Fertilizers', 'fertilizers'], ['Seeds', 'seeds'], ['Pesticides', 'pesticides'],
  ['Insecticides', 'insecticides'], ['Fungicides', 'fungicides'], ['Herbicides', 'herbicides'], ['Bio inputs', 'bio-inputs'],
  ['Micronutrients', 'micronutrients'], ['Plant growth products', 'plant-growth-products'],
  ['Equipment', 'equipment'], ['Irrigation', 'irrigation'],
];
const brands = [
  'IFFCO', 'Mahyco', 'T. Stanes', 'Multiplex', 'Coromandel', 'Jain Irrigation',
  'OmniFert', 'SABIC', 'Yara', 'Mavuno', 'AgriGrow', 'Indo-American Seeds',
  'East-West Seed', 'Namdhari Seeds', 'Gharda', 'Agrofil', 'Katyayani', 'AgriCare',
];

const products = [
  { name: 'Urea Fertilizer 46% N', slug: 'urea-fertilizer-46', category: 'fertilizers', brand: 'OmniFert', packSize: '45 kg', unit: 'bag', price: 266, mrp: 280, stock: 180 },
  { name: 'DAP Fertilizer 18:46:0', slug: 'dap-fertilizer-18-46', category: 'fertilizers', brand: 'SABIC', packSize: '50 kg', unit: 'bag', price: 1350, mrp: 1450, stock: 92 },
  { name: 'YaraMila NPK 10:24:24', slug: 'yaramila-npk-102424', category: 'fertilizers', brand: 'Yara', packSize: '25 kg', unit: 'bag', price: 1240, mrp: 1390, stock: 64 },
  { name: 'Mavuno Field Fertilizer', slug: 'mavuno-field-fertilizer', category: 'fertilizers', brand: 'Mavuno', packSize: '50 kg', unit: 'bag', price: 1190, mrp: 1320, stock: 48 },
  { name: 'Granular Urea Fertilizer', slug: 'granular-urea-5kg', category: 'fertilizers', brand: 'AgriGrow', packSize: '5 kg', unit: 'bag', price: 420, mrp: 480, stock: 125 },
  { name: 'Hybrid Tomato Seeds', slug: 'hybrid-tomato-seeds', category: 'seeds', brand: 'Indo-American Seeds', packSize: '10 g', unit: 'packet', price: 350, mrp: 390, stock: 220 },
  { name: 'Hybrid Brinjal Seeds', slug: 'hybrid-brinjal-seeds', category: 'seeds', brand: 'Mahyco', packSize: '10 g', unit: 'packet', price: 300, mrp: 340, stock: 156 },
  { name: 'Hybrid Chilli Seeds', slug: 'hybrid-chilli-seeds', category: 'seeds', brand: 'Mahyco', packSize: '10 g', unit: 'packet', price: 540, mrp: 590, stock: 138 },
  { name: 'Hybrid Cucumber Seeds', slug: 'hybrid-cucumber-seeds', category: 'seeds', brand: 'East-West Seed', packSize: '10 g', unit: 'packet', price: 280, mrp: 320, stock: 96 },
  { name: 'Hybrid Okra Seeds', slug: 'hybrid-okra-seeds', category: 'seeds', brand: 'Namdhari Seeds', packSize: '10 g', unit: 'packet', price: 320, mrp: 360, stock: 112 },
  { name: 'Hamla 550 Insecticide', slug: 'hamla-550-insecticide', category: 'pesticides', brand: 'Gharda', packSize: '500 ml', unit: 'bottle', price: 720, mrp: 780, stock: 70 },
  { name: 'Filban Insecticide 20% EC', slug: 'filban-insecticide-20ec', category: 'pesticides', brand: 'Agrofil', packSize: '500 ml', unit: 'bottle', price: 280, mrp: 320, stock: 80 },
  { name: 'Hamla 550 Insecticide 1 L', slug: 'hamla-insecticide-1l', category: 'pesticides', brand: 'Gharda', packSize: '1 litre', unit: 'bottle', price: 980, mrp: 1120, stock: 42 },
  { name: 'Hamla Crop Care 250 ml', slug: 'hamla-crop-care-250ml', category: 'pesticides', brand: 'Gharda', packSize: '250 ml', unit: 'bottle', price: 274, mrp: 310, stock: 105 },
  { name: 'Crop Spray Protection', slug: 'crop-spray-protection', category: 'pesticides', brand: 'AgriCare', packSize: '1 set', unit: 'set', price: 650, mrp: 720, stock: 32 },
];

async function main() {
  const categoryIds = new Map<string, string>();
  const brandIds = new Map<string, string>();

  for (const [name, slug] of categories) {
    const category = await prisma.category.upsert({ where: { slug }, update: { name, isActive: true }, create: { name, slug } });
    categoryIds.set(slug, category.id);
  }
  for (const name of brands) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const brand = await prisma.brand.upsert({ where: { slug }, update: { name, isActive: true }, create: { name, slug } });
    brandIds.set(name, brand.id);
  }

  const existingSupplier = await prisma.organization.findFirst({ where: { name: 'Agri-One Demo Supplier', type: OrganizationType.SUPPLIER } });
  const supplier = existingSupplier
    ? await prisma.organization.update({ where: { id: existingSupplier.id }, data: { verificationStatus: VerificationStatus.APPROVED } })
    : await prisma.organization.create({ data: { name: 'Agri-One Demo Supplier', type: OrganizationType.SUPPLIER, verificationStatus: VerificationStatus.APPROVED, phone: '+919933329102', email: 'supplier@agri-one.demo' } });

  for (const item of products) {
    const categoryId = categoryIds.get(item.category)!;
    const brandId = brandIds.get(item.brand)!;
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: { name: item.name, categoryId, brandId, packSize: item.packSize, unit: item.unit, status: ProductStatus.APPROVED },
      create: { name: item.name, slug: item.slug, categoryId, brandId, packSize: item.packSize, unit: item.unit, status: ProductStatus.APPROVED },
    });
    const sellerSku = `AGRI-${item.slug.toUpperCase()}`;
    const offer = await prisma.productOffer.upsert({
      where: { sellerOrganizationId_sellerSku: { sellerOrganizationId: supplier.id, sellerSku } },
      update: { productId: product.id, price: item.price, mrp: item.mrp, stockOnHand: item.stock, isActive: true, source: FulfillmentSource.MARKETPLACE },
      create: { productId: product.id, sellerOrganizationId: supplier.id, source: FulfillmentSource.MARKETPLACE, sellerSku, price: item.price, mrp: item.mrp, stockOnHand: item.stock, isActive: true },
    });
    await prisma.offerServiceArea.upsert({
      where: { offerId_pinCode: { offerId: offer.id, pinCode: '736101' } },
      update: {},
      create: { offerId: offer.id, pinCode: '736101' },
    });
  }

  console.info(`Seeded ${categories.length} categories, ${brands.length} brands, and ${products.length} approved products (5 each for fertilizers, seeds, and pesticides).`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
