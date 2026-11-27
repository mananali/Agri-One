export type MarketplaceProduct = {
  id: string;
  offerId?: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  pack: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: string;
  badge: string;
  art: "bag" | "seed" | "bottle" | "tractor";
  tone: string;
  image: string;
  imageAlt: string;
  imageFit?: "cover" | "contain";
  description: string;
  createdAt?: string;
};

export const marketplaceCategories = [
  { name: "Fertilizers", icon: "🛍️", tone: "mint" },
  { name: "Seeds", icon: "🌱", tone: "sage" },
  { name: "Pesticides", icon: "🧴", tone: "peach" },
  { name: "Equipment", icon: "🚜", tone: "sky" },
  { name: "Organic Products", icon: "🍃", tone: "lime" },
  { name: "All Products", icon: "▦", tone: "lilac" },
];

export const marketplaceProducts: MarketplaceProduct[] = [
  { id: "urea-46", slug: "urea-fertilizer-46", name: "Urea Fertilizer 46% N", brand: "OmniFert", category: "Fertilizers", pack: "45 kg bag", price: 266, mrp: 280, rating: 4.7, reviews: "1.2k", badge: "Best seller", art: "bag", tone: "green", image: "/products/fertilizer-urea.webp", imageAlt: "Urea fertilizer bag photographed in a crop field", imageFit: "contain", description: "High quality nitrogen fertilizer for healthy crop growth. Suitable for a wide range of field crops." },
  { id: "tomato-seeds", slug: "hybrid-tomato-seeds", name: "Hybrid Tomato Seeds", brand: "Indo-American Seeds", category: "Seeds", pack: "10 g packet", price: 350, mrp: 390, rating: 4.6, reviews: "856", badge: "Popular", art: "seed", tone: "red", image: "/products/seed-indam.webp", imageAlt: "Hybrid tomato seed packet with ripe tomato photography", imageFit: "contain", description: "Carefully selected hybrid tomato seeds with strong germination and uniform fruit development." },
  { id: "trance-bottle", slug: "katyayani-trance", name: "Hamla 550 Insecticide", brand: "Gharda", category: "Pesticides", pack: "500 ml bottle", price: 720, mrp: 780, rating: 4.7, reviews: "732", badge: "Top rated", art: "bottle", tone: "blue", image: "/products/pesticide-hamla.webp", imageAlt: "Hamla 550 crop insecticide bottle", imageFit: "contain", description: "A crop care solution for farm pest management. Follow product label instructions and local agricultural guidance." },
  { id: "dap-18", slug: "dap-fertilizer-18-46", name: "DAP Fertilizer 18:46:0", brand: "SABIC", category: "Fertilizers", pack: "50 kg bag", price: 1350, mrp: 1450, rating: 4.8, reviews: "980", badge: "5% off", art: "bag", tone: "lime", image: "/products/fertilizer-dap.webp", imageAlt: "DAP fertilizer sack in a farm setting", imageFit: "contain", description: "Phosphorus and nitrogen nutrition to support strong early root and crop development." },
  { id: "brinjal-seeds", slug: "hybrid-brinjal-seeds", name: "Hybrid Brinjal Seeds", brand: "Mahyco", category: "Seeds", pack: "10 g packet", price: 300, mrp: 340, rating: 4.5, reviews: "416", badge: "New season", art: "seed", tone: "purple", image: "/products/seed-variety.webp", imageAlt: "A selection of vegetable seed packets", imageFit: "contain", description: "Hybrid brinjal seed selected for healthy plants and consistent harvests." },
  { id: "chilli-seeds", slug: "hybrid-chilli-seeds", name: "Hybrid Chilli Seeds", brand: "Mahyco", category: "Seeds", pack: "10 g packet", price: 540, mrp: 590, rating: 4.6, reviews: "522", badge: "Popular", art: "seed", tone: "orange", image: "/products/seed-shelf.webp", imageAlt: "Vegetable seed packets displayed on a garden shop shelf", imageFit: "cover", description: "A reliable hybrid chilli variety for productive home and commercial cultivation." },
  { id: "neem-care", slug: "neem-crop-care", name: "Neem Crop Care", brand: "T. Stanes", category: "Organic Products", pack: "1 litre bottle", price: 490, mrp: 550, rating: 4.5, reviews: "218", badge: "Organic pick", art: "bottle", tone: "green", image: "/products/pesticide-field.webp", imageAlt: "Farmer spraying a crop with plant protection solution", imageFit: "cover", description: "Plant based crop care for integrated farm management. Read label directions before use." },
  { id: "sprayer-kit", slug: "farm-sprayer-kit", name: "Farm Sprayer Kit", brand: "AgriPro", category: "Equipment", pack: "1 set", price: 1890, mrp: 2200, rating: 4.4, reviews: "194", badge: "Value pick", art: "tractor", tone: "yellow", image: "/products/pesticide-field.webp", imageAlt: "Crop sprayer equipment being used in a field", imageFit: "cover", description: "A practical farm equipment kit for everyday crop care and field operations." },
  { id: "yara-npk", slug: "yaramila-npk-102424", name: "YaraMila NPK 10:24:24", brand: "Yara", category: "Fertilizers", pack: "25 kg bag", price: 1240, mrp: 1390, rating: 4.6, reviews: "324", badge: "Balanced nutrition", art: "bag", tone: "green", image: "/products/fertilizer-npk.webp", imageAlt: "YaraMila granular fertilizer bag", imageFit: "contain", description: "Balanced granular crop nutrition for healthy roots and steady crop development." },
  { id: "mavuno-fertilizer", slug: "mavuno-field-fertilizer", name: "Mavuno Field Fertilizer", brand: "Mavuno", category: "Fertilizers", pack: "50 kg bag", price: 1190, mrp: 1320, rating: 4.5, reviews: "207", badge: "Farm choice", art: "bag", tone: "lime", image: "/products/fertilizer-field.webp", imageAlt: "Fertilizer bag beside growing crops", imageFit: "cover", description: "Field fertilizer for seasonal crop nutrition. Select application rates based on local guidance." },
  { id: "granular-urea", slug: "granular-urea-5kg", name: "Granular Urea Fertilizer", brand: "AgriGrow", category: "Fertilizers", pack: "5 kg bag", price: 420, mrp: 480, rating: 4.4, reviews: "143", badge: "Value pack", art: "bag", tone: "green", image: "/products/fertilizer-urea-field.webp", imageAlt: "Granular urea fertilizer package", imageFit: "contain", description: "Easy-to-handle granular urea for small farms and kitchen gardens." },
  { id: "cucumber-seeds", slug: "hybrid-cucumber-seeds", name: "Hybrid Cucumber Seeds", brand: "East-West Seed", category: "Seeds", pack: "10 g packet", price: 280, mrp: 320, rating: 4.5, reviews: "294", badge: "Fast growing", art: "seed", tone: "green", image: "/products/seed-packets.webp", imageAlt: "Real vegetable seed packets arranged for planting", imageFit: "contain", description: "Hybrid cucumber seed selected for vigorous vines and dependable fruiting." },
  { id: "okra-seeds", slug: "hybrid-okra-seeds", name: "Hybrid Okra Seeds", brand: "Namdhari Seeds", category: "Seeds", pack: "10 g packet", price: 320, mrp: 360, rating: 4.4, reviews: "176", badge: "Season pick", art: "seed", tone: "lime", image: "/products/seed-hands.webp", imageAlt: "A handful of real crop seeds ready for sowing", imageFit: "cover", description: "Hybrid okra seeds for productive plants and a steady harvest through the season." },
  { id: "filban-insecticide", slug: "filban-insecticide-20ec", name: "Filban Insecticide 20% EC", brand: "Agrofil", category: "Pesticides", pack: "500 ml bottle", price: 280, mrp: 320, rating: 4.5, reviews: "184", badge: "Crop protection", art: "bottle", tone: "green", image: "/products/pesticide-filban.webp", imageAlt: "Filban chlorpyriphos insecticide bottle", imageFit: "contain", description: "Crop protection product. Always read the label and follow local agricultural advice." },
  { id: "hamla-insecticide", slug: "hamla-insecticide-1l", name: "Hamla 550 Insecticide 1 L", brand: "Gharda", category: "Pesticides", pack: "1 litre bottle", price: 980, mrp: 1120, rating: 4.6, reviews: "267", badge: "Dealer choice", art: "bottle", tone: "orange", image: "/products/pesticide-hamla2.webp", imageAlt: "Hamla 550 insecticide container", imageFit: "contain", description: "Insecticide for crop pest management. Follow all product label safety directions." },
  { id: "hamla-crop-care", slug: "hamla-crop-care-250ml", name: "Hamla Crop Care 250 ml", brand: "Gharda", category: "Pesticides", pack: "250 ml bottle", price: 274, mrp: 310, rating: 4.5, reviews: "156", badge: "Popular", art: "bottle", tone: "blue", image: "/products/pesticide-bighaat.webp", imageAlt: "Hamla crop insecticide bottle from an Indian farm supply listing", imageFit: "contain", description: "Crop insecticide for farm use. Follow label directions and wear recommended protective equipment." },
  { id: "crop-spray-care", slug: "crop-spray-protection", name: "Crop Spray Protection", brand: "AgriCare", category: "Pesticides", pack: "Field application", price: 650, mrp: 720, rating: 4.5, reviews: "121", badge: "Field use", art: "bottle", tone: "green", image: "/products/pesticide-field.webp", imageAlt: "A farmer applying crop protection spray in a green field", imageFit: "cover", description: "A crop protection service demo item. Choose the correct product and application method with local expert advice." },
];

export const formatRupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
