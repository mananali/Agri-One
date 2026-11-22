"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { marketplaceCategories, marketplaceProducts, formatRupees, type MarketplaceProduct } from "@/lib/agri-data";
import { fetchCatalogBrands, fetchCatalogProduct, fetchCatalogProducts, type CatalogBrand } from "@/lib/catalog-api";
import { BrandMark } from "@/components/BrandMark";

type CartLine = { id: string; quantity: number };
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const API_ORIGIN = new URL(API_BASE).origin;
const HOME_BANNERS = [
  { src: "/agri-one-banner.png", alt: "Agri-One smart farming solutions with a farmer and field" },
  { src: "/agri-one-banner1.png", alt: "Agri-One agriculture marketplace with fertilizer products" },
  { src: "/agri-one-banner2.png", alt: "Agri-One agriculture marketplace with crop protection products" },
  { src: "/agri-one-banner3.png", alt: "Agri-One agriculture marketplace with seeds and crop products" },
] as const;
const HOME_CATEGORY_CARDS = [
  { name: "Fertilizers", slug: "fertilizers", bengali: "\u09B8\u09BE\u09B0", description: "Urea, DAP, NPK and more", image: "/products/fertilizer-dap.webp", alt: "Fertilizer bags" },
  { name: "Seeds", slug: "seeds", bengali: "\u09AC\u09C0\u099C", description: "Rice, corn, vegetable and other seeds", image: "/products/seed-variety.webp", alt: "Vegetable seed packets" },
  { name: "Pesticides", slug: "pesticides", bengali: "\u0995\u09C0\u099F\u09A8\u09BE\u09B6\u0995", description: "Insecticide, fungicide and herbicide", image: "/products/pesticide-hamla.webp", alt: "Crop protection bottle" },
  { name: "Equipment", slug: "equipment", bengali: "\u0995\u09C3\u09B7\u09BF \u09AF\u09A8\u09CD\u09A4\u09CD\u09B0\u09AA\u09BE\u09A4\u09BF", description: "Sprayers, irrigation and more", image: "", alt: "Farm equipment" },
] as const;
const CART_KEY = "agri-one-cart-v2";
const CART_PRODUCTS_KEY = "agri-one-cart-products-v1";
const DEMO_CART: CartLine[] = [{ id: "urea-46", quantity: 1 }, { id: "tomato-seeds", quantity: 1 }];
const EMPTY_CART: CartLine[] = [];
let cartSnapshot = EMPTY_CART;
let cartInitialized = false;

function getCart(): CartLine[] {
  return getCartSnapshot();
}

function getCartSnapshot(): CartLine[] {
  if (typeof window === "undefined") return EMPTY_CART;
  if (!cartInitialized) {
    try { cartSnapshot = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as CartLine[]; } catch { cartSnapshot = EMPTY_CART; }
    cartInitialized = true;
  }
  return cartSnapshot;
}

function subscribeCart(callback: () => void) {
  window.addEventListener("agri-cart-change", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("agri-cart-change", callback); window.removeEventListener("storage", callback); };
}

function useCart() {
  return useSyncExternalStore(subscribeCart, getCartSnapshot, () => EMPTY_CART);
}

function saveCart(lines: CartLine[]) {
  cartSnapshot = lines;
  cartInitialized = true;
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("agri-cart-change"));
}

function addCartItem(id: string, quantity = 1, product?: MarketplaceProduct) {
  if (product && typeof window !== "undefined") {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CART_PRODUCTS_KEY) ?? "{}") as Record<string, MarketplaceProduct>;
      cached[id] = product;
      window.localStorage.setItem(CART_PRODUCTS_KEY, JSON.stringify(cached));
    } catch { window.localStorage.setItem(CART_PRODUCTS_KEY, JSON.stringify({ [id]: product })); }
  }
  const current = getCart();
  const found = current.find((line) => line.id === id);
  saveCart(found ? current.map((line) => line.id === id ? { ...line, quantity: line.quantity + quantity } : line) : [...current, { id, quantity }]);
}

function getCartProduct(id: string): MarketplaceProduct | undefined {
  const localProduct = marketplaceProducts.find((product) => product.id === id);
  if (typeof window === "undefined") return localProduct;
  try {
    const cached = JSON.parse(window.localStorage.getItem(CART_PRODUCTS_KEY) ?? "{}") as Record<string, MarketplaceProduct>;
    return cached[id] ?? localProduct;
  } catch { return undefined; }
}

export function AgriHeader() {
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  return <>
    <div className="agri-topbar"><div className="agri-container agri-topbar-inner"><span>⌖ <b>Balarampur Bazar, Cooch Behar, WB</b></span><a href="tel:+919933329102">☎ <b>9933329102</b></a><div className="agri-toplinks"><Link href="/farmer">Farmer Helpline</Link><i/> <Link href="/retailer">Track Order</Link><i/> <Link href="/contact">Support</Link><span className="agri-social-mini">f&nbsp; ▶&nbsp;◎</span></div></div></div>
    <header className="agri-header"><div className="agri-container agri-header-inner"><Link href="/" className="agri-logo"><BrandMark className="agri-logo-mark"/><span><strong>Agri-<b>One</b></strong><small>Smart Farming Solutions</small></span></Link><button className="agri-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span className="agri-menu-icon" aria-hidden="true"/></button><nav className={menuOpen ? "agri-reference-nav is-open" : "agri-reference-nav"}><Link href="/" className={`agri-reference-nav-link ${pathname === "/" ? "is-active" : ""}`} onClick={() => setMenuOpen(false)}><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="m2 9 8-7 8 7v9h-6v-6H8v6H2z" fill="currentColor"/></svg>Home</Link><Link href="/products" className={`agri-reference-nav-link has-menu ${pathname.startsWith("/products") ? "is-active" : ""}`} onClick={() => setMenuOpen(false)}>Products</Link><Link href="/categories" className={`agri-reference-nav-link has-menu ${pathname === "/categories" ? "is-active" : ""}`} onClick={() => setMenuOpen(false)}>Categories</Link><Link href="/about" className={`agri-reference-nav-link ${pathname === "/about" ? "is-active" : ""}`} onClick={() => setMenuOpen(false)}>About Us</Link><Link href="/contact" className={`agri-reference-nav-link ${pathname === "/contact" ? "is-active" : ""}`} onClick={() => setMenuOpen(false)}>Contact</Link></nav><form className="agri-search" onSubmit={(event) => { event.preventDefault(); router.push(`/products?search=${encodeURIComponent(search)}`); }}><svg className="agri-search-leading" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input aria-label="Search products" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)}/><button aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></button></form><Link href="/login" className="agri-account"><svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="8" r="5"/><path d="M4 25v-3a10 10 0 0 1 20 0v3z"/></svg><span><small>For Retailer</small>Login</span></Link><Link href="/cart" className="agri-cart-link" aria-label={`Shopping cart, ${cartCount} items`}><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M2 4h4l3.2 15.2a2 2 0 0 0 2 1.6h12.5a2 2 0 0 0 1.9-1.4L29 9H8"/><circle cx="12" cy="25" r="1.8"/><circle cx="23" cy="25" r="1.8"/></svg><b>{cartCount}</b></Link></div></header>
  </>;
}

export function AgriFooter() {
  const [subscribed, setSubscribed] = useState(false);
  return <footer className="agri-footer"><div className="agri-container agri-footer-grid"><div className="agri-footer-brand"><Link href="/" className="agri-logo agri-logo-light"><span className="agri-logo-mark">❧</span><span><strong>Agri-<b>One</b></strong><small>Smart Farming Solutions</small></span></Link><p>Building a digital agriculture ecosystem for a prosperous India.</p><div className="agri-socials"><a href="#facebook" aria-label="Facebook">f</a><a href="#youtube" aria-label="YouTube">▶</a><a href="#instagram" aria-label="Instagram">◎</a><a href="#whatsapp" aria-label="WhatsApp">◉</a></div></div><div><h3>Quick Links</h3><Link href="/">Home</Link><Link href="/products">Products</Link><Link href="/about">About Us</Link><Link href="/contact">Contact</Link></div><div><h3>Our Services</h3><Link href="/products">Online Purchase</Link><Link href="/retailer">Wholesale Supply</Link><Link href="/farmer">Farmer Support</Link><Link href="/about">Crop Advisory</Link></div><div><h3>Contact Us</h3><p>☎ &nbsp;+91 9933329102</p><p>⌖ &nbsp;Balarampur Bazar,<br/> &nbsp;&nbsp;&nbsp; Cooch Behar, WB</p><a href="mailto:support@agri-one.in">✉ &nbsp;support@agri-one.in</a></div><div className="agri-subscribe"><h3>Subscribe for Updates</h3><p>Get latest offers &amp; farming tips.</p>{subscribed ? <div className="agri-subscribe-success">Thanks for subscribing!</div> : <form onSubmit={(event) => { event.preventDefault(); setSubscribed(true); }}><input aria-label="Your email address" type="email" required placeholder="Your Email Address"/><button aria-label="Subscribe">➤</button></form>}</div></div><div className="agri-footer-bottom"><div className="agri-container"><span>© 2026 Agri-One. All Rights Reserved.</span><span>Made with <b>♥</b> for Farmers of India</span></div></div></footer>;
}

export function AgriSite({ children }: { children: React.ReactNode }) {
  return <div className="agri-site"><AgriHeader/>{children}<AgriFooter/></div>;
}

export function ProductArt({ product, compact = false }: { product: MarketplaceProduct; compact?: boolean }) {
  if (product.image) {
    return <div className={`agri-product-art has-photo art-${product.tone} ${product.imageFit === "cover" ? "photo-cover" : "photo-contain"} ${compact ? "is-compact" : ""}`}>
      <Image className="agri-product-photo" src={product.image} alt={product.imageAlt || product.name} fill sizes={compact ? "72px" : "(max-width: 760px) 45vw, 260px"} unoptimized={product.image.startsWith("http")} />
    </div>;
  }
  return <div className={`agri-product-art art-${product.art} art-${product.tone} ${compact ? "is-compact" : ""}`} aria-label={`${product.name} product illustration`}>
    {product.art === "bag" && <div className="art-bag"><div className="art-brand">{product.brand}</div><strong>{product.name.split(" ").slice(0, 2).join(" ")}</strong><span>{product.name.includes("Urea") ? "46% N" : "18:46:0"}</span><small>AGRICULTURE GRADE</small></div>}
    {product.art === "seed" && <div className="art-packet"><div className="art-brand">{product.brand.split(" ")[0]}</div><span>🌿</span><strong>{product.name.replace("Hybrid ", "")}</strong><small>HYBRID SEEDS</small></div>}
    {product.art === "bottle" && <div className="art-bottle"><i/><div><b>{product.brand}</b><strong>{product.name.split(" ").slice(-1)[0]}</strong><small>CROP CARE</small></div></div>}
    {product.art === "tractor" && <div className="art-machine">🚜<small>AGRI PRO</small></div>}
    {!compact && <span className="agri-art-spark">✳</span>}
  </div>;
}

function ProductCard({ product, onAdded }: { product: MarketplaceProduct; onAdded?: () => void }) {
  const [liked, setLiked] = useState(false);
  const outOfStock = product.badge.toLowerCase() === "out of stock";
  const discount = product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;
  return <article className={outOfStock ? "agri-product-card is-out-of-stock" : "agri-product-card"}><div className="agri-product-card-image"><Link href={"/products/" + product.slug}><ProductArt product={product}/></Link><span className={outOfStock ? "agri-product-badge is-out-of-stock" : "agri-product-badge"}>{product.badge}</span><button className={liked ? "agri-favorite is-favorite" : "agri-favorite"} onClick={() => setLiked(!liked)} aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}>{liked ? "\u2665" : "\u2661"}</button></div><div className="agri-product-info"><small>{product.brand} <i/> {product.pack}</small><Link href={"/products/" + product.slug}><h3>{product.name}</h3></Link><p className="agri-product-short-description">{product.description}</p><strong className="agri-card-price">{formatRupees(product.price)} <del>{formatRupees(product.mrp)}</del></strong>{discount > 0 && <span className="agri-discount-tag">{discount}% OFF</span>}<div className="agri-rating"><span>{"\u2605"}</span> {product.rating} <small>({product.reviews} reviews)</small></div><button className="agri-outline-button agri-add-button" disabled={outOfStock} onClick={() => { if (outOfStock) return; addCartItem(product.id, 1, product); onAdded?.(); }}>{outOfStock ? "Out of stock" : "\u{1F6D2}  Add to Cart"}</button></div></article>;
}

function SectionHeading({ icon, title, href, action }: { icon: string; title: string; href?: string; action?: string }) {
  return <div className="agri-section-heading"><h2>{icon && <span>{icon}</span>}{title}</h2>{href && <Link href={href}>{action ?? "View All"} <b>→</b></Link>}</div>;
}

export function MarketplaceHome() {
  const [heroSlide, setHeroSlide] = useState(0);
  const [toast, setToast] = useState("");
  const [homeProducts, setHomeProducts] = useState<MarketplaceProduct[]>(marketplaceProducts);
  const [homeCategoryImages, setHomeCategoryImages] = useState<Record<string, string>>({});
  const [homeBrands, setHomeBrands] = useState<CatalogBrand[]>(() => [...new Map(marketplaceProducts.map((product) => [product.brand, { id: product.brand, name: product.brand, slug: product.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-") }])).values()]);
  useEffect(() => {
    const timer = window.setInterval(() => setHeroSlide((current) => (current + 1) % HOME_BANNERS.length), 2850);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_BASE}/catalog/home-category-cards`, { signal: controller.signal, cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<Record<string, string>> : {}).then(setHomeCategoryImages).catch(() => undefined);
    void fetchCatalogProducts({ signal: controller.signal }).then(setHomeProducts).catch(() => { if (!controller.signal.aborted) setHomeProducts(marketplaceProducts); });
    void fetchCatalogBrands(controller.signal).then((brands) => { if (brands.length) setHomeBrands(brands); }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const added = () => { setToast("Added to your cart"); window.setTimeout(() => setToast(""), 1800); };
  const moveHero = (offset: number) => setHeroSlide((current) => (current + offset + HOME_BANNERS.length) % HOME_BANNERS.length);
  const latestProducts = useMemo(() => {
    const popularIds = new Set(homeProducts.slice(0, 8).map((product) => product.id));
    return [...homeProducts]
      .sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0))
      .filter((product) => !popularIds.has(product.id))
      .slice(0, 8);
  }, [homeProducts]);
  return <AgriSite><main>
    <section className="agri-hero"><div className="agri-hero-carousel" role="region" aria-roledescription="carousel" aria-label="Agri-One featured banners"><div className="agri-hero-track" style={{ transform: `translateX(-${heroSlide * 100}%)` }}>{HOME_BANNERS.map((banner, index) => <div className={`agri-hero-slide ${heroSlide === index ? "is-active" : ""}`} key={banner.src} aria-hidden={heroSlide !== index}><Link className="agri-hero-banner" href="/products" tabIndex={heroSlide === index ? 0 : -1} aria-label={`Shop products from banner ${index + 1}`}><Image src={banner.src} alt={banner.alt} width={1600} height={500} priority={index === 0} /></Link></div>)}</div><button className="agri-carousel-arrow agri-carousel-prev" type="button" aria-label="Previous banner" onClick={() => moveHero(-1)}>&#8249;</button><button className="agri-carousel-arrow agri-carousel-next" type="button" aria-label="Next banner" onClick={() => moveHero(1)}>&#8250;</button><div className="agri-carousel-dots" aria-label="Choose a banner">{HOME_BANNERS.map((banner, index) => <button key={banner.src} type="button" className={heroSlide === index ? "is-active" : ""} aria-label={`Show banner ${index + 1}`} aria-current={heroSlide === index ? "true" : undefined} onClick={() => setHeroSlide(index)} />)}</div></div></section>
    <div className="agri-container agri-home-content"><section className="agri-home-section agri-home-category-section"><div className="agri-home-category-heading"><SectionHeading icon="🌿" title="Shop By Category" href="/categories" action="View All Categories"/><Link className="agri-category-all-products" href="/products">All Products <b>→</b></Link></div><div className="agri-category-feature-grid">{HOME_CATEGORY_CARDS.map((category) => { const image = homeCategoryImages[category.slug] ? `${API_ORIGIN}${homeCategoryImages[category.slug]}` : category.image; return <Link className="agri-category-feature-card" href={`/products?category=${category.slug}`} key={category.slug}><span className="agri-category-feature-art">{image ? <Image src={image} alt={category.alt} width={200} height={170} sizes="(max-width: 760px) 42vw, 200px" unoptimized={image.startsWith("http")}/> : <span aria-hidden="true">🚜</span>}</span><span className="agri-category-feature-copy"><span className="agri-category-bengali" lang="bn">{category.bengali}</span><strong>{category.name}</strong><small>{category.description}</small><span className="agri-category-view-all">View All <b>→</b></span></span></Link>; })}</div></section>
    <section className="agri-home-section agri-home-products"><SectionHeading icon="" title="Popular Products" href="/products" action="View All Products"/><div className="agri-product-grid">{homeProducts.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} onAdded={added}/>)}</div></section><section className="agri-home-section agri-home-brand-section"><SectionHeading icon="" title="Shop by Trusted Brand" href="/brands" action="View All Brands"/><div className="agri-home-brand-grid">{homeBrands.slice(0, 10).map((brand) => { const logo = brand.imageUrl ? (brand.imageUrl.startsWith("http") ? brand.imageUrl : `${API_ORIGIN}${brand.imageUrl}`) : ""; return <Link className="agri-home-brand-card" href={`/products?search=${encodeURIComponent(brand.name)}`} key={brand.id}><span className={logo ? "has-image" : ""}>{logo ? <Image src={logo} alt={`${brand.name} logo`} width={72} height={72} unoptimized/> : brand.name.slice(0, 1)}</span><div><strong>{brand.name}</strong>{brand.description && <small>{brand.description}</small>}</div></Link>; })}</div></section><section className="agri-home-section agri-home-products"><SectionHeading icon="" title="New Arrivals" href="/products" action="Explore All"/><div className="agri-product-grid">{latestProducts.map((product) => <ProductCard key={`new-${product.id}`} product={product} onAdded={added}/>)}</div></section><section className="agri-home-wholesale-section"><aside className="agri-wholesale-promo"><span>FOR RETAILERS &amp; DEALERS</span><h3>Get <em>Wholesale<br/>Price</em></h3><p>Better margins for your business.</p><Link href="/retailer">Apply Now</Link><div className="promo-leaves">*</div></aside></section><div className="agri-home-all-products"><Link className="agri-primary-button" href="/products">Browse All Products</Link></div></div>
    <section className="agri-why"><div className="agri-container agri-why-inner"><div><h2>Why Choose<br/>Agri-<em>One</em>?</h2><p>Your Trusted Agriculture Partner</p></div><div className="agri-benefit"><b>⬟</b><span>Verified<br/>Suppliers</span></div><div className="agri-benefit"><b>◆</b><span>Competitive<br/>Prices</span></div><div className="agri-benefit"><b>▰</b><span>Fast Delivery<br/>Across India</span></div><div className="agri-benefit"><b>☏</b><span>Expert<br/>Support</span></div></div></section>
    <section className="agri-container agri-roles-section"><SectionHeading icon="♟" title="For Everyone — One Platform"/><div className="agri-role-cards"><Link href="/farmer" className="agri-role-card role-farmer"><span>👨🏽‍🌾</span><div><strong>Farmer Dashboard</strong><small>Buy products, get advice,<br/>track orders</small><b>Explore →</b></div></Link><Link href="/retailer" className="agri-role-card role-retailer"><span>🧑🏽‍💼</span><div><strong>Retailer Dashboard</strong><small>Manage stock &amp; orders,<br/>get best price</small><b>Explore →</b></div></Link><Link href="/supplier" className="agri-role-card role-supplier"><span>👨🏻‍🌾</span><div><strong>Supplier Dashboard</strong><small>List products, manage<br/>inventory</small><b>Explore →</b></div></Link><Link href="/admin" className="agri-role-card role-admin"><span>📊</span><div><strong>Admin Dashboard</strong><small>Manage business &amp;<br/>get reports</small><b>Explore →</b></div></Link></div></section>
  </main>{toast && <div className="agri-toast" role="status">✓ {toast}</div>}</AgriSite>;
}

export function ProductsListingPage({ initialCategory = "All Products", initialSearch = "" }: { initialCategory?: string; initialSearch?: string }) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState("Popular");
  const [priceLimit, setPriceLimit] = useState(2500);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<MarketplaceProduct[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const categorySlug = category === "All Products" ? undefined : category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    void fetchCatalogProducts({ category: categorySlug, search, signal: controller.signal })
      .then(setCatalogProducts)
      .catch(() => { if (!controller.signal.aborted) setCatalogProducts(null); });
    return () => controller.abort();
  }, [category, search]);
  const sourceProducts = catalogProducts ?? marketplaceProducts;
  const visible = useMemo(() => {
    const categorySlug = category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const rows = sourceProducts.filter((product) => (category === "All Products" || product.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === categorySlug) && product.price <= priceLimit && `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(search.toLowerCase()));
    if (sort === "Price: Low to High") rows.sort((a, b) => a.price - b.price);
    if (sort === "Price: High to Low") rows.sort((a, b) => b.price - a.price);
    return rows;
  }, [category, priceLimit, search, sort, sourceProducts]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 6));
  const paged = visible.slice((page - 1) * 6, page * 6);
  return <AgriSite><main className="agri-container agri-listing-page"><PageBanner title="Our Products" subtitle="Premium quality agricultural products for every farm"/><div className="agri-listing-layout"><aside className="agri-filter-panel"><h3>Categories</h3>{["All Products", ...marketplaceCategories.slice(0, 5).map((item) => item.name), "Soil Care", "Plant Nutrition"].map((name) => <button key={name} className={(category === "All Products" ? name === "All Products" : category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) ? "is-active" : ""} onClick={() => { setCategory(name); setPage(1); }}><span>◉</span>{name}</button>)}<hr/><h3>Price up to {formatRupees(priceLimit)}</h3><input type="range" min="100" max="2500" step="50" value={priceLimit} onChange={(event) => { setPriceLimit(Number(event.target.value)); setPage(1); }}/><div className="agri-price-range"><span>₹100</span><span>₹2,500+</span></div></aside><section className="agri-listing-results"><div className="agri-listing-toolbar"><label>⌕ <input placeholder="Search products..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/></label><span>{visible.length} products</span><select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)}><option>Popular</option><option>Price: Low to High</option><option>Price: High to Low</option></select></div><div className="agri-product-grid">{paged.map((product) => <ProductCard key={product.id} product={product} onAdded={() => { setToast("Added to your cart"); window.setTimeout(() => setToast(""), 1600); }}/>)}</div>{visible.length === 0 && <div className="agri-empty">No products found. Try another search or category.</div>}<div className="agri-pagination"><button disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>&#8249;</button>{Array.from({ length: pageCount }, (_, index) => <button key={index + 1} className={page === index + 1 ? "is-current" : ""} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button disabled={page === pageCount} onClick={() => setPage(Math.min(pageCount, page + 1))}>&#8250;</button></div></section></div></main>{toast && <div className="agri-toast">✓ {toast}</div>}</AgriSite>;
}

export function CategoriesLandingPage() {
  const categories = [...marketplaceCategories.slice(0, 5), { name: "Soil Care", icon: "🪴", tone: "mint" }, { name: "Plant Nutrition", icon: "🧪", tone: "peach" }, { name: "All Products", icon: "▦", tone: "sky" }];
  return <AgriSite><main className="agri-container"><PageBanner title="Categories" subtitle="Find the right products for your farm" variant="category"/><section className="agri-category-page"><aside><h3>All Categories</h3>{categories.map((item) => <Link key={item.name} href={item.name === "All Products" ? "/products" : `/products?category=${encodeURIComponent(item.name)}`}>◉ &nbsp;{item.name}</Link>)}</aside><div><div className="agri-category-grid">{categories.map((item) => <Link className={`agri-category-large tone-${item.tone}`} key={item.name} href={item.name === "All Products" ? "/products" : `/products?category=${encodeURIComponent(item.name)}`}><span>{item.icon}</span><strong>{item.name}</strong><small>Explore products →</small></Link>)}</div><div className="agri-smart-banner"><span>🍃</span><strong>Smart Farming for a Better Tomorrow</strong><Link href="/products">Shop Now →</Link></div></div></section></main></AgriSite>;
}

function PageBanner({ title, subtitle, variant = "products" }: { title: string; subtitle: string; variant?: string }) {
  return <section className={`agri-page-banner banner-${variant}`}><div><span>AGRI-ONE MARKETPLACE</span><h1>{title}</h1><p>{subtitle}</p></div>{variant === "products" && <div className="agri-banner-fruit">🌾 &nbsp; 🌿</div>}</section>;
}

export function ProductDetailsPage({ slug }: { slug: string }) {
  const router = useRouter();
  const fallbackProduct = marketplaceProducts.find((item) => item.slug === slug) ?? marketplaceProducts[0];
  const [catalogProduct, setCatalogProduct] = useState<MarketplaceProduct | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetchCatalogProduct(slug, controller.signal).then(setCatalogProduct).catch(() => { if (!controller.signal.aborted) setCatalogProduct(null); });
    return () => controller.abort();
  }, [slug]);
  const product = catalogProduct ?? fallbackProduct;
  const outOfStock = product.badge.toLowerCase() === "out of stock";
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("Description");
  const [toast, setToast] = useState("");
  const buy = () => { if (outOfStock) return; addCartItem(product.id, quantity, product); router.push("/cart"); };
  return <AgriSite><main className="agri-container agri-details-page"><div className="agri-breadcrumb"><Link href="/">Home</Link> › <Link href="/products">Products</Link> › {product.name}</div><section className="agri-detail-card"><div className="agri-detail-visual"><ProductArt product={product}/><div className="agri-detail-thumbs">{[product, marketplaceProducts[0], marketplaceProducts[3]].map((image, i) => <button key={`${image.id}-${i}`} onClick={() => setToast("Product image selected")}><ProductArt product={image} compact/></button>)}</div></div><div className="agri-detail-copy"><span className="agri-product-badge">{product.badge}</span><h1>{product.name}</h1><div className="agri-rating"><span>★</span> {product.rating} <small>({product.reviews} reviews)</small></div><div className="agri-detail-price"><strong>{formatRupees(product.price)} <small>/ {product.pack.split(" ").slice(-1)}</small></strong><del>{formatRupees(product.mrp)}</del><b>{Math.round((1 - product.price / product.mrp) * 100)}% OFF</b></div><p className={outOfStock ? "agri-stock is-out-of-stock" : "agri-stock"}>? &nbsp;{outOfStock ? "Out of stock" : "In Stock"}<small>{outOfStock ? "Currently unavailable" : "Ready to ship"}</small></p><p className="agri-detail-description">{product.description}</p><div className="agri-quantity"><span>Quantity</span><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><b>{quantity}</b><button onClick={() => setQuantity(quantity + 1)}>+</button></div><button className="agri-primary-button agri-detail-add" disabled={outOfStock} onClick={() => { if (outOfStock) return; addCartItem(product.id, quantity, product); setToast("Added to your cart"); window.setTimeout(() => setToast(""), 1600); }}>{outOfStock ? "Out of stock" : "Add to Cart"}</button><button className="agri-outline-button agri-buy-button" disabled={outOfStock} onClick={buy}>▣ &nbsp; Buy Now</button><div className="agri-detail-promises"><span>♧ &nbsp;100% Original Product</span><span>▰ &nbsp;Fast Delivery</span><span>↺ &nbsp;Easy Return</span></div></div></section><section className="agri-product-tabs"><div className="agri-tab-buttons">{["Description", "Specifications", "Reviews"].map((name) => <button className={tab === name ? "is-selected" : ""} key={name} onClick={() => setTab(name)}>{name}</button>)}</div><div className="agri-tab-content">{tab === "Description" ? <p>{product.description} Agri-One sources products from verified sellers for a more confident shopping experience.</p> : tab === "Specifications" ? <div className="agri-spec-table"><span>Brand</span><b>{product.brand}</b><span>Pack size</span><b>{product.pack}</b><span>Category</span><b>{product.category}</b><span>Availability</span><b>{outOfStock ? "Out of stock" : "In stock"}</b></div> : <p>Rated {product.rating} out of 5 by {product.reviews} shoppers. Customer reviews will appear here.</p>}</div><div className="agri-field-photo"/></section><section className="agri-home-section"><SectionHeading icon="🌱" title="You May Also Like" href="/products"/><div className="agri-product-grid agri-related-grid">{marketplaceProducts.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <ProductCard key={item.id} product={item}/>)}</div></section></main>{toast && <div className="agri-toast">✓ {toast}</div>}</AgriSite>;
}

export function CartPage() {
  const cart = useCart();
  useEffect(() => {
    const raw = window.localStorage.getItem(CART_KEY);
    if (raw === null) saveCart(DEMO_CART);
  }, []);
  const items = cart.map((line) => ({ line, product: getCartProduct(line.id) })).filter((item): item is { line: CartLine; product: MarketplaceProduct } => Boolean(item.product));
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.line.quantity, 0);
  const updateQuantity = (id: string, quantity: number) => { const next = cart.map((line) => line.id === id ? { ...line, quantity } : line).filter((line) => line.quantity > 0); saveCart(next); };
  return <AgriSite><main className="agri-container agri-cart-page"><div className="agri-breadcrumb"><Link href="/">Home</Link> › Cart</div><h1>Your Cart <small>({items.length} items)</small></h1><div className="agri-cart-layout"><section className="agri-cart-lines">{items.map(({ line, product }) => <article className="agri-cart-line" key={line.id}><Link href={`/products/${product.slug}`}><ProductArt product={product} compact/></Link><div className="agri-cart-product"><Link href={`/products/${product.slug}`}><strong>{product.name}</strong></Link><small>{product.brand} · {product.pack}</small><span>In Stock</span></div><div className="agri-quantity"><button onClick={() => updateQuantity(line.id, line.quantity - 1)}>−</button><b>{line.quantity}</b><button onClick={() => updateQuantity(line.id, line.quantity + 1)}>+</button></div><strong className="agri-cart-price">{formatRupees(product.price * line.quantity)}</strong><button className="agri-remove" onClick={() => updateQuantity(line.id, 0)} aria-label={`Remove ${product.name}`}>×</button></article>)}{items.length === 0 && <div className="agri-empty"><h2>Your cart is empty</h2><p>Explore our catalogue and find something for your farm.</p><Link className="agri-primary-button" href="/products">Continue Shopping →</Link></div>}<Link href="/products" className="agri-continue-link">← Continue Shopping</Link></section><aside className="agri-order-summary"><h2>Order Summary</h2><div><span>Subtotal</span><b>{formatRupees(subtotal)}</b></div><div><span>Shipping</span><b>{subtotal ? "₹50" : "₹0"}</b></div><div><span>Tax</span><b>Calculated at checkout</b></div><hr/><div className="agri-summary-total"><strong>Total</strong><strong>{formatRupees(subtotal + (subtotal ? 50 : 0))}</strong></div><Link className="agri-primary-button" href={items.length ? "/checkout" : "/products"}>{items.length ? "Proceed to Checkout →" : "Shop Products →"}</Link><small>🔒 Secure checkout · Easy returns</small></aside></div></main></AgriSite>;
}

export function CheckoutPage() {
  const cart = useCart();
  const [placed, setPlaced] = useState("");
  const [payment, setPayment] = useState("UPI");
  const items = cart.map((line) => ({ line, product: getCartProduct(line.id) })).filter((item): item is { line: CartLine; product: MarketplaceProduct } => Boolean(item.product));
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.line.quantity, 0);
  const placeOrder = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPlaced(`AO-${Date.now().toString().slice(-8)}`); saveCart([]); };
  return <AgriSite><main className="agri-container agri-checkout-page"><div className="agri-breadcrumb"><Link href="/">Home</Link> › <Link href="/cart">Cart</Link> › Checkout</div><h1>{placed ? "Order Confirmed" : "Checkout"}</h1>{placed ? <section className="agri-order-success"><span>✓</span><h2>Thank you for your order!</h2><p>Your demo order <strong>{placed}</strong> has been placed.</p><p>Payment method: {payment}. No payment was collected.</p><Link className="agri-primary-button" href="/products">Continue Shopping →</Link></section> : <form className="agri-checkout-layout" onSubmit={placeOrder}><div className="agri-checkout-main"><section className="agri-checkout-panel"><div className="agri-panel-title"><h2>Delivery Address</h2><button type="button" onClick={() => document.getElementById("delivery-name")?.focus()}>＋ Add New Address</button></div><label className="agri-address-card"><input type="radio" name="address" defaultChecked/><span><strong>Manan Ali</strong><small>Balarampur Bazar, Cooch Behar<br/>West Bengal · 736101</small></span><b>Change</b></label><div className="agri-checkout-fields"><label>Full Name<input id="delivery-name" required defaultValue="Manan Ali"/></label><label>Phone Number<input required type="tel" defaultValue="+91 9933329102"/></label><label>Address<textarea required defaultValue="Balarampur Bazar, Cooch Behar"/></label><label>PIN Code<input required inputMode="numeric" maxLength={6} defaultValue="736101"/></label></div></section><section className="agri-checkout-panel"><h2>Payment Method</h2><div className="agri-payment-options">{["UPI", "Card", "Net Banking", "Cash on Delivery"].map((method) => <label key={method}><input type="radio" name="payment" value={method} checked={payment === method} onChange={() => setPayment(method)}/><span>{method}</span></label>)}</div></section></div><aside className="agri-order-summary"><h2>Order Summary</h2>{items.map(({ line, product }) => <div className="agri-checkout-item" key={line.id}><ProductArt product={product} compact/><span>{product.name}<small>Qty: {line.quantity}</small></span><b>{formatRupees(product.price * line.quantity)}</b></div>)}{items.length === 0 && <p>Your cart is empty. <Link href="/products">Browse products</Link></p>}<div><span>Subtotal</span><b>{formatRupees(subtotal)}</b></div><div><span>Delivery Charge</span><b>₹50</b></div><hr/><div className="agri-summary-total"><strong>Total</strong><strong>{formatRupees(subtotal + (subtotal ? 50 : 0))}</strong></div><button className="agri-primary-button" disabled={!items.length}>Place Order 🔒</button><small>Demo checkout. No payment will be collected.</small></aside></form>}</main></AgriSite>;
}

export function AboutLandingPage() {
  return <AgriSite><main className="agri-container agri-about-page"><PageBanner title="About Agri-One" subtitle="Growing Together for a Greener Tomorrow" variant="about"/><section className="agri-about-intro"><div><span className="agri-eyebrow">OUR STORY</span><h2>Rooted in agriculture.<br/>Built for <em>tomorrow.</em></h2><p>Agri-One is a trusted agriculture marketplace from Cooch Behar, committed to supporting farmers, retailers and suppliers with quality products, fair prices and expert guidance.</p><p>We bring the agricultural community closer by making everyday farm inputs easier to discover and source.</p><Link className="agri-primary-button" href="/products">Explore Products →</Link></div><div className="agri-about-image"><span>🍃</span><b>Growing stronger, together.</b></div></section><section className="agri-about-stats"><div><strong>10K+</strong><span>Farmers</span></div><div><strong>5K+</strong><span>Retailers</span></div><div><strong>500+</strong><span>Suppliers</span></div><div><strong>99%</strong><span>Satisfaction</span></div></section><section className="agri-about-values"><h2>Our commitment to every grower</h2><div><article><b>✓</b><h3>5+ Years of Trust</h3><p>Building lasting relationships across the agricultural community.</p></article><article><b>♧</b><h3>Pan-India Support</h3><p>Helping people find the products and support they need.</p></article><article><b>◆</b><h3>Quality First</h3><p>Connecting buyers to trusted suppliers and genuine products.</p></article></div></section></main></AgriSite>;
}

export function ContactLandingPage() {
  const [sent, setSent] = useState(false);
  return <AgriSite><main className="agri-container agri-contact-page"><PageBanner title="Contact Us" subtitle="We&apos;re here to help you!" variant="contact"/><div className="agri-contact-layout"><section className="agri-contact-details"><span className="agri-eyebrow">GET IN TOUCH</span><h2>Let&apos;s talk about<br/>your next harvest.</h2><p>Our team is ready to help with orders, products and growing your business.</p><a href="tel:+919933329102"><b>☎</b><span><strong>+91 9933329102</strong><small>Mon – Sat, 9AM – 7PM</small></span></a><a href="mailto:support@agri-one.in"><b>✉</b><span><strong>support@agri-one.in</strong><small>We usually reply within one business day</small></span></a><div className="agri-location-card"><b>⌖</b><span><strong>Balarampur Bazar</strong><small>Cooch Behar, West Bengal</small></span><div>📍</div></div></section><section className="agri-contact-form"><h2>Send a Message</h2>{sent ? <div className="agri-contact-success"><b>✓</b><strong>Message received!</strong><span>Thanks for contacting Agri-One. We&apos;ll be in touch soon.</span><button onClick={() => setSent(false)}>Send another message</button></div> : <form onSubmit={(event) => { event.preventDefault(); setSent(true); }}><label>Your Name<input required placeholder="Your Name"/></label><label>Your Email<input required type="email" placeholder="Your Email"/></label><label>Your Phone<input type="tel" placeholder="+91"/></label><label>Your Message<textarea required rows={4} placeholder="Tell us how we can help..."/></label><button className="agri-primary-button">Send Message →</button></form>}</section></div></main></AgriSite>;
}
