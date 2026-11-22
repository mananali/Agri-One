import { marketplaceProducts, type MarketplaceProduct } from "./agri-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

type CatalogOffer = {
  price: number | string;
  mrp?: number | string | null;
  availableStock?: number;
  seller?: { name: string };
};

type CatalogRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  packSize?: string | null;
  unit?: string | null;
  category: { name: string; slug: string };
  brand?: { name: string } | null;
  offers: CatalogOffer[];
  createdAt?: string;
  imageUrl?: string | null;
};

type CatalogResponse = {
  data: CatalogRecord[];
  pagination?: { total: number; totalPages: number };
};

const categoryMedia: Record<string, Pick<MarketplaceProduct, "art" | "tone" | "image" | "imageAlt" | "imageFit">> = {
  fertilizers: { art: "bag", tone: "green", image: "/products/fertilizer-urea.webp", imageAlt: "Fertilizer product", imageFit: "contain" },
  seeds: { art: "seed", tone: "green", image: "/products/seed-variety.webp", imageAlt: "Crop seed products", imageFit: "contain" },
  pesticides: { art: "bottle", tone: "green", image: "/products/pesticide-hamla.webp", imageAlt: "Crop protection product", imageFit: "contain" },
  equipment: { art: "tractor", tone: "yellow", image: "", imageAlt: "Farm equipment", imageFit: "contain" },
};

function toProduct(record: CatalogRecord): MarketplaceProduct {
  const sortedOffers = [...(record.offers ?? [])].sort((a, b) => Number(a.price) - Number(b.price));
  const offer = sortedOffers.find((item) => (item.availableStock ?? 0) > 0) ?? sortedOffers[0];
  const price = Number(offer?.price ?? 0);
  const mrp = Number(offer?.mrp ?? price);
  const media = categoryMedia[record.category.slug] ?? categoryMedia.equipment;

  return {
    id: marketplaceProducts.find((product) => product.slug === record.slug)?.id ?? record.id,
    slug: record.slug,
    name: record.name,
    brand: record.brand?.name ?? offer?.seller?.name ?? "Agri-One",
    category: record.category.name,
    pack: [record.packSize, record.unit].filter(Boolean).join(" ") || "Available pack",
    price,
    mrp,
    rating: 0,
    reviews: "New",
    badge: (offer?.availableStock ?? 0) > 0 ? "In stock" : "Out of stock",
    ...media,
    image: record.imageUrl ? (record.imageUrl.startsWith("http") ? record.imageUrl : `${new URL(API_BASE).origin}${record.imageUrl}`) : media.image,
    imageAlt: `${record.name} product image`,
    description: record.description ?? "Approved product from the Agri-One catalogue.",
    createdAt: record.createdAt,
  };
}

export type CatalogBrand = { id: string; name: string; slug: string; description?: string | null; imageUrl?: string | null };

export async function fetchCatalogBrands(signal: AbortSignal): Promise<CatalogBrand[]> {
  const response = await fetch(`${API_BASE}/catalog/brands`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Brand request failed (${response.status})`);
  const brands = (await response.json()) as CatalogBrand[];
  if (!Array.isArray(brands)) throw new Error("Brand response is invalid");
  return brands;
}

export async function fetchCatalogProducts(options: {
  category?: string;
  search?: string;
  signal: AbortSignal;
}): Promise<MarketplaceProduct[]> {
  const params = new URLSearchParams({ pageSize: "100" });
  if (options.category) params.set("category", options.category);
  if (options.search?.trim()) params.set("search", options.search.trim());
  const requestPage = async (page: number) => {
    const pageParams = new URLSearchParams(params);
    pageParams.set("page", String(page));
    const response = await fetch(`${API_BASE}/catalog/products?${pageParams}`, {
      signal: options.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
    return (await response.json()) as CatalogResponse;
  };

  const payload = await requestPage(1);
  if (!Array.isArray(payload.data)) throw new Error("Catalogue response is invalid");
  const totalPages = Math.max(1, payload.pagination?.totalPages ?? 1);
  const laterPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => requestPage(index + 2)));
  return [payload, ...laterPages].flatMap((page) => page.data).map(toProduct);
}

export async function fetchCatalogProduct(slug: string, signal: AbortSignal): Promise<MarketplaceProduct> {
  const response = await fetch(`${API_BASE}/catalog/products/${encodeURIComponent(slug)}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Product request failed (${response.status})`);
  return toProduct((await response.json()) as CatalogRecord);
}
