"use client";
import { BrandMark } from "@/components/BrandMark";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/agri-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const API_ORIGIN = new URL(API_BASE).origin;
type Tab = "overview" | "products" | "retailers" | "suppliers" | "users" | "orders" | "catalog" | "home-cards";
type ProductStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
type AdminOffer = { id: string; sellerSku: string; price: number | string; mrp: number | string | null; minimumOrderQuantity: number; stockOnHand: number; reservedQuantity: number; commissionRate: number | string; isActive: boolean; source: string; seller: { id: string; name: string; type: string } };
type AdminProduct = { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; packSize: string; unit: string; taxRate: number | string; status: ProductStatus; category: { id: string; name: string }; brand: { id: string; name: string } | null; offers: AdminOffer[] };
type Organization = { id: string; name: string; type: string; email: string | null; phone: string | null; verificationStatus: string; verificationReason: string | null; createdAt: string; _count: { users: number; kycDocuments: number } };
type Account = { id: string; name: string; email: string; phone: string | null; role: string; status: string; createdAt: string; organization: { id: string; name: string; type: string; verificationStatus: string } | null };
type Order = { id: string; orderNumber: string; status: string; total: number | string; createdAt: string; deliveryName: string; deliveryDistrict: string; retailer: { id: string; name: string }; fulfillments: { id: string; status: string; seller: { id: string; name: string }; lines: { quantity: number; productNameSnapshot: string }[] }[] };
type Named = { id: string; name: string; slug: string; description?: string | null; imageUrl?: string | null; isActive?: boolean; _count?: { products: number } };
type ProductForm = { name: string; categoryId: string; brandId: string; description: string; imageUrl: string; packSize: string; unit: string; price: string; mrp: string; taxRate: string; sellerSku: string; minimumOrderQuantity: string; stockOnHand: string; status: ProductStatus };

const emptyForm = (categoryId = ""): ProductForm => ({ name: "", categoryId, brandId: "", description: "", imageUrl: "", packSize: "", unit: "piece", price: "", mrp: "", taxRate: "0", sellerSku: `AO-${Date.now().toString().slice(-7)}`, minimumOrderQuantity: "1", stockOnHand: "0", status: "APPROVED" });
const nav: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "products", label: "Products & Stock", icon: "▤" },
  { id: "retailers", label: "Retailers", icon: "♙" },
  { id: "suppliers", label: "Suppliers", icon: "♧" },
  { id: "users", label: "All User Accounts", icon: "♙" },
  { id: "orders", label: "Orders", icon: "▣" },
  { id: "catalog", label: "Categories & Brands", icon: "◈" },
  { id: "home-cards", label: "Homepage card images", icon: "▧" },
];
const HOME_CARD_SETTINGS = [
  { slug: "fertilizers", name: "Fertilizers", defaultImage: "/products/fertilizer-dap.webp" },
  { slug: "seeds", name: "Seeds", defaultImage: "/products/seed-variety.webp" },
  { slug: "pesticides", name: "Pesticides", defaultImage: "/products/pesticide-hamla.webp" },
  { slug: "equipment", name: "Equipment", defaultImage: "" },
];

export function AdminControlPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Named[]>([]);
  const [brands, setBrands] = useState<Named[]>([]);
  const [homeCategoryCards, setHomeCategoryCards] = useState<Record<string, string>>({});
  const [homeCardFiles, setHomeCardFiles] = useState<Record<string, File>>({});
  const [homeCardPreviews, setHomeCardPreviews] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newBrand, setNewBrand] = useState("");

  const api = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
    return body as T;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [stats, productPage, retailerOrgs, supplierOrgs, userPage, orderPage, catalog, homeCards] = await Promise.all([
        api<Record<string, number>>("/admin/overview"),
        api<{ data: AdminProduct[] }>("/admin/products?pageSize=100"),
        api<{ data: Organization[] }>("/admin/organizations?page=1&type=RETAILER"),
        api<{ data: Organization[] }>("/admin/organizations?page=1&type=SUPPLIER"),
        api<{ data: Account[] }>("/admin/users?pageSize=100"),
        api<{ data: Order[] }>("/admin/orders?pageSize=100"),
        api<{ categories: Named[]; brands: Named[] }>("/admin/catalog-structure"),
        api<Record<string, string>>("/admin/home-category-cards"),
      ]);
      setOverview(stats); setProducts(productPage.data); setOrganizations([...retailerOrgs.data, ...supplierOrgs.data]); setAccounts(userPage.data); setOrders(orderPage.data); setCategories(catalog.categories); setBrands(catalog.brands); setHomeCategoryCards(homeCards);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load admin data";
      setError(message);
      if (message.includes("401") || message.toLowerCase().includes("bearer") || message.toLowerCase().includes("expired")) setToken("");
    } finally { setLoading(false); }
  }, [api, token]);

  useEffect(() => { setToken(window.sessionStorage.getItem("agri-one-access-token") ?? ""); }, []);
  useEffect(() => { if (token) void refresh(); else setLoading(false); }, [token, refresh]);

  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setError("");
    try { await action(); showNotice(success); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed"); }
    finally { setBusy(false); }
  };
  const filteredProducts = useMemo(() => products.filter((item) => `${item.name} ${item.brand?.name ?? ""} ${item.category.name} ${item.status}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const filteredOrgs = useMemo(() => organizations.filter((item) => item.type === (tab === "retailers" ? "RETAILER" : "SUPPLIER") && `${item.name} ${item.email ?? ""} ${item.verificationStatus}`.toLowerCase().includes(search.toLowerCase())), [organizations, search, tab]);
  const filteredOrders = useMemo(() => orders.filter((item) => `${item.orderNumber} ${item.retailer.name} ${item.status}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const filteredAccounts = useMemo(() => accounts.filter((item) => `${item.name} ${item.email} ${item.role} ${item.organization?.name ?? ""} ${item.status}`.toLowerCase().includes(search.toLowerCase())), [accounts, search]);

  const openNewProduct = () => { setEditing(null); setForm(emptyForm(categories[0]?.id)); setImageFile(null); setImagePreview(""); setShowProductForm(true); };
  const openEditProduct = (item: AdminProduct) => {
    const offer = item.offers.find((entry) => entry.source === "AGRI_ONE_STOCK") ?? item.offers[0];
    setEditing(item); setImageFile(null); setImagePreview(item.imageUrl ? `${API_ORIGIN}${item.imageUrl}` : "");
    setForm({ name: item.name, categoryId: item.category.id, brandId: item.brand?.id ?? "", description: item.description ?? "", imageUrl: item.imageUrl ?? "", packSize: item.packSize, unit: item.unit, price: String(offer?.price ?? ""), mrp: String(offer?.mrp ?? offer?.price ?? ""), taxRate: String(item.taxRate ?? 0), sellerSku: offer?.sellerSku ?? `AO-${Date.now().toString().slice(-7)}`, minimumOrderQuantity: String(offer?.minimumOrderQuantity ?? 1), stockOnHand: String(offer?.stockOnHand ?? 0), status: item.status });
    setShowProductForm(true);
  };
  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be smaller than 5 MB"); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  };
  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const upload = new FormData(); upload.set("image", imageFile);
        const result = await api<{ imageUrl: string }>("/admin/products/image", { method: "POST", body: upload });
        imageUrl = result.imageUrl;
      }
      const body = { ...form, brandId: form.brandId || null, imageUrl, price: Number(form.price), mrp: Number(form.mrp || form.price), taxRate: Number(form.taxRate), minimumOrderQuantity: Number(form.minimumOrderQuantity), stockOnHand: Number(form.stockOnHand) };
      await api(editing ? `/admin/products/${editing.id}` : "/admin/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setShowProductForm(false); setImageFile(null); showNotice(editing ? "Product updated" : "Product added to catalogue"); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save product"); }
    finally { setBusy(false); }
  };
  const verifyOrganization = (id: string, status: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION") => run(async () => { await api(`/admin/organizations/${id}/verification`, { method: "PATCH", body: JSON.stringify({ status, reason: status === "APPROVED" ? undefined : "Please review the business details and submit corrections." }) }); }, `Business ${status.toLowerCase().replaceAll("_", " ")}`);
  const setAccountStatus = (id: string, status: "ACTIVE" | "DISABLED") => run(async () => { await api(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); }, `Account ${status.toLowerCase()}`);
  const setOrderStatus = (id: string, status: string) => run(async () => { await api(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); }, "Order status updated");
  const saveOffer = (id: string, payload: Omit<AdminOffer, "id" | "sellerSku" | "source" | "seller" | "reservedQuantity">) => run(async () => { await api(`/admin/offers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }, "Seller offer and stock updated");
  const archiveProduct = (id: string) => run(async () => { await api(`/admin/products/${id}/archive`, { method: "PATCH" }); }, "Product removed from the public shop");
  const addNamed = (kind: "categories" | "brands", name: string, clear: () => void) => run(async () => { await api(`/admin/${kind}`, { method: "POST", body: JSON.stringify({ name }) }); clear(); }, `${kind === "categories" ? "Category" : "Brand"} added`);
  const saveBrand = (id: string, details: { name: string; description: string; imageUrl: string }, file?: File) => run(async () => {
    let imageUrl = details.imageUrl;
    if (file) { const data = new FormData(); data.set("image", file); const uploaded = await api<{ imageUrl: string }>("/admin/brands/image", { method: "POST", body: data }); imageUrl = uploaded.imageUrl; }
    await api(`/admin/brands/${id}`, { method: "PATCH", body: JSON.stringify({ ...details, imageUrl }) });
  }, "Brand details published to the homepage");
  const setCatalogActive = (kind: "categories" | "brands", id: string, isActive: boolean) => run(async () => { await api(`/admin/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }); }, `${kind === "categories" ? "Category" : "Brand"} ${isActive ? "enabled" : "disabled"}`);
  const selectHomeCardImage = (slug: string, file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG, WebP, or AVIF image under 5 MB"); return; }
    setError("");
    setHomeCardFiles((current) => ({ ...current, [slug]: file }));
    if (homeCardPreviews[slug]) URL.revokeObjectURL(homeCardPreviews[slug]);
    setHomeCardPreviews((current) => ({ ...current, [slug]: URL.createObjectURL(file) }));
  };
  const uploadHomeCardImage = async (slug: string) => {
    const file = homeCardFiles[slug];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.set("image", file);
      const result = await api<{ slug: string; imageUrl: string }>(`/admin/home-category-cards/${slug}/image`, { method: "POST", body: data });
      setHomeCategoryCards((current) => ({ ...current, [result.slug]: result.imageUrl }));
      setHomeCardFiles((current) => { const next = { ...current }; delete next[slug]; return next; });
      if (homeCardPreviews[slug]) URL.revokeObjectURL(homeCardPreviews[slug]);
      setHomeCardPreviews((current) => { const next = { ...current }; delete next[slug]; return next; });
      showNotice(`${HOME_CARD_SETTINGS.find((item) => item.slug === slug)?.name ?? "Category"} image published on homepage`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not upload category image"); }
    finally { setBusy(false); }
  };

  if (!token) return <div className="admin-auth-screen"><div><span className="admin-auth-icon"><BrandMark className="admin-auth-mark"/></span><h1>Admin sign-in required</h1><p>Sign in with an administrator account to manage the Agri-One marketplace.</p>{error && <p className="admin-error">{error}</p>}<Link className="agri-primary-button" href="/login?next=%2Fadmin">Go to Admin Login</Link></div></div>;

  return <div className="admin-console">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand"><BrandMark className="admin-brand-mark"/><b>Agri-One<small>Platform Admin</small></b></Link><div className="admin-side-label">WORKSPACE</div><nav>{nav.map((item) => <button key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => { setTab(item.id); setSearch(""); }}><span>{item.icon}</span>{item.label}{item.id === "products" && overview.pendingProducts > 0 && <i>{overview.pendingProducts}</i>}</button>)}</nav><div className="admin-side-bottom"><span className="admin-avatar">AO</span><div><b>Administrator</b><small>Full platform access</small></div><button aria-label="Log out" onClick={() => { window.sessionStorage.removeItem("agri-one-access-token"); setToken(""); router.push("/login"); }}>↪</button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><span>Admin /</span> {nav.find((item) => item.id === tab)?.label}</div><div><span className="admin-live-dot"/> Live backend <button onClick={() => void refresh()}>↻ Refresh</button></div></header><div className="admin-page">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">AGRI-ONE CONTROL CENTER</span><h1>{tab === "overview" ? "Marketplace overview" : nav.find((item) => item.id === tab)?.label}</h1><p>{tab === "overview" ? "Manage the entire marketplace from one place." : `Review and manage ${nav.find((item) => item.id === tab)?.label.toLowerCase()} across the platform.`}</p></div>{tab === "products" && <button className="admin-primary" onClick={openNewProduct}>＋ Add Product</button>}</div>
      {error && <div className="admin-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
      {loading && <div className="admin-loading">Loading live marketplace data…</div>}
      {!loading && tab === "overview" && <Overview stats={overview} products={products.slice(0, 5)} orders={orders.slice(0, 5)} organizations={organizations.filter((item) => item.verificationStatus === "PENDING").slice(0, 5)} onTab={setTab}/>} 
      {!loading && tab === "products" && <ProductsPanel products={filteredProducts} search={search} onSearch={setSearch} onEdit={openEditProduct} onNew={openNewProduct} onOfferSave={saveOffer} onArchive={archiveProduct}/>} 
      {!loading && (tab === "retailers" || tab === "suppliers") && <OrganizationsPanel organizations={filteredOrgs} accounts={accounts.filter((item) => item.role === (tab === "retailers" ? "RETAILER" : "SUPPLIER"))} search={search} onSearch={setSearch} onVerify={verifyOrganization} onAccountStatus={setAccountStatus}/>} 
      {!loading && tab === "users" && <AllAccountsPanel accounts={filteredAccounts} search={search} onSearch={setSearch} onAccountStatus={setAccountStatus}/>} 
      {!loading && tab === "orders" && <OrdersPanel orders={filteredOrders} search={search} onSearch={setSearch} onStatus={setOrderStatus}/>} 
      {!loading && tab === "catalog" && <CatalogPanel categories={categories} brands={brands} newCategory={newCategory} newBrand={newBrand} setNewCategory={setNewCategory} setNewBrand={setNewBrand} addNamed={addNamed} setActive={setCatalogActive} onSaveBrand={saveBrand} busy={busy}/>} 
      {!loading && tab === "home-cards" && <HomeCardsPanel cards={homeCategoryCards} previews={homeCardPreviews} onSelect={selectHomeCardImage} onSave={uploadHomeCardImage} busy={busy}/>} 
      {showProductForm && <ProductEditor form={form} setForm={setForm} categories={categories} brands={brands} editing={editing} imagePreview={imagePreview} busy={busy} onImage={selectImage} onClose={() => setShowProductForm(false)} onSubmit={saveProduct}/>}
      <footer className="admin-footer-note">All changes are saved to the Agri-One backend and recorded for platform operations.</footer>
    </div></main>{notice && <div className="admin-notice" role="status">✓ {notice}</div>}</div>;
}

function Overview({ stats, products, orders, organizations, onTab }: { stats: Record<string, number>; products: AdminProduct[]; orders: Order[]; organizations: Organization[]; onTab: (tab: Tab) => void }) {
  const cards = [["Total users", stats.users ?? 0, "Across all marketplace roles", "♙", "green"], ["Retailers", stats.retailers ?? 0, "Retail business accounts", "▤", "blue"], ["Suppliers", stats.suppliers ?? 0, "Supplier organizations", "♧", "orange"], ["Catalogue products", stats.products ?? 0, `${stats.pendingProducts ?? 0} awaiting review`, "▣", "purple"], ["Orders", stats.orders ?? 0, "Placed across the platform", "▦", "green"], ["Marketplace sales", formatRupees(stats.revenue ?? 0), "Excluding cancelled orders", "₹", "orange"]] as const;
  return <><div className="admin-stat-grid">{cards.map(([label, value, note, icon, tone]) => <article className={`admin-stat admin-${tone}`} key={label}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>)}</div><div className="admin-overview-grid"><section className="admin-panel admin-wide"><PanelTitle title="Recent orders" caption="Latest retailer purchases" action="All orders" onAction={() => onTab("orders")}/>{orders.length ? <div className="admin-table-scroll"><table><thead><tr><th>Order</th><th>Retailer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b>{order.orderNumber}</b></td><td>{order.retailer.name}</td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td>{formatRupees(Number(order.total))}</td><td><Status value={order.status}/></td></tr>)}</tbody></table></div> : <Empty>No orders have been placed yet.</Empty>}</section><section className="admin-panel"><PanelTitle title="Business approvals" caption="Retailers and suppliers" action="Review" onAction={() => onTab("retailers")}/>{organizations.length ? organizations.map((org) => <div className="admin-list-row" key={org.id}><span className="admin-row-avatar">{org.name.slice(0, 1)}</span><div><b>{org.name}</b><small>{org.type.toLowerCase()} · {org._count.users} account(s)</small></div><Status value={org.verificationStatus}/></div>) : <Empty>No pending business reviews.</Empty>}<div className="admin-split-actions"><button onClick={() => onTab("retailers")}>Retailers</button><button onClick={() => onTab("suppliers")}>Suppliers</button></div></section></div><div className="admin-overview-grid"><section className="admin-panel"><PanelTitle title="Product catalogue" caption="Recently updated products" action="Manage products" onAction={() => onTab("products")}/>{products.length ? products.map((product) => <div className="admin-list-row" key={product.id}><ProductThumb image={product.imageUrl} name={product.name}/><div><b>{product.name}</b><small>{product.category.name} · {product.brand?.name ?? "No brand"}</small></div><Status value={product.status}/></div>) : <Empty>No products are in the catalogue.</Empty>}</section><section className="admin-panel admin-quick-panel"><PanelTitle title="Quick controls" caption="Common platform tasks"/><button onClick={() => onTab("products")}>＋ Add or update products <b>→</b></button><button onClick={() => onTab("retailers")}>♙ Verify retailer accounts <b>→</b></button><button onClick={() => onTab("suppliers")}>♧ Review supplier accounts <b>→</b></button><button onClick={() => onTab("catalog")}>◈ Edit categories and brands <b>→</b></button><button onClick={() => onTab("home-cards")}>▧ Change homepage card images <b>→</b></button></section></div></>;
}

function HomeCardsPanel({ cards, previews, onSelect, onSave, busy }: { cards: Record<string, string>; previews: Record<string, string>; onSelect: (slug: string, file?: File) => void; onSave: (slug: string) => void; busy: boolean }) {
  return <section className="admin-panel admin-home-cards-panel"><PanelTitle title="Homepage category images" caption="Upload your own image for each of the four category cards. Publishing updates the public homepage right away."/><div className="admin-home-card-grid">{HOME_CARD_SETTINGS.map((card) => {
    const imageUrl = cards[card.slug] ? `${API_ORIGIN}${cards[card.slug]}` : card.defaultImage;
    const preview = previews[card.slug] ?? imageUrl;
    return <article className="admin-home-card-editor" key={card.slug}><div className="admin-home-card-preview">{preview ? <Image src={preview} alt={`${card.name} category card preview`} fill unoptimized/> : <span aria-hidden="true">🚜</span>}</div><div className="admin-home-card-copy"><div><h3>{card.name}</h3><p>{previews[card.slug] ? "New image ready to publish" : cards[card.slug] ? "Custom homepage image" : "Current default image"}</p></div><label className="admin-home-card-picker">Choose image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => onSelect(card.slug, event.currentTarget.files?.[0])}/></label><button className="admin-primary" type="button" disabled={busy || !previews[card.slug]} onClick={() => onSave(card.slug)}>{busy ? "Uploading…" : "Upload & publish"}</button><small>JPG, PNG, WebP, or AVIF · max 5 MB</small></div></article>;
  })}</div></section>;
}

function ProductsPanel({ products, search, onSearch, onEdit, onNew, onOfferSave, onArchive }: { products: AdminProduct[]; search: string; onSearch: (value: string) => void; onEdit: (product: AdminProduct) => void; onNew: () => void; onOfferSave: (id: string, payload: Omit<AdminOffer, "id" | "sellerSku" | "source" | "seller" | "reservedQuantity">) => void; onArchive: (id: string) => void }) {
  return <section className="admin-panel"><div className="admin-toolbar"><label>? <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search products, brands, status?"/></label><span>{products.length} products</span><button className="admin-primary" onClick={onNew}>+ Add Product</button></div><div className="admin-product-list">{products.map((product) => { const offer = product.offers.find((entry) => entry.source === "AGRI_ONE_STOCK") ?? product.offers[0]; return <div className="admin-product-management" key={product.id}><article className="admin-product-row"><ProductThumb image={product.imageUrl} name={product.name}/><div className="admin-product-name"><b>{product.name}</b><small>{product.brand?.name ?? "No brand"} ? {product.category.name} ? {product.packSize} {product.unit}</small><small>{product.offers.length} offer(s) ? SKU {offer?.sellerSku ?? "?"}</small></div><div><b>{offer ? formatRupees(Number(offer.price)) : "No offer"}</b><small>Stock {offer?.stockOnHand ?? 0} ? {offer?.seller.name ?? "?"}</small></div><Status value={product.status}/><div className="admin-product-controls"><button className="admin-secondary" onClick={() => onEdit(product)}>Edit details</button><button className="admin-danger" disabled={product.status === "ARCHIVED"} onClick={() => onArchive(product.id)}>{product.status === "ARCHIVED" ? "Removed" : "Remove from shop"}</button></div></article>{product.offers.length > 0 && <details className="admin-offer-details"><summary>Manage supplier offers and inventory ({product.offers.length})</summary><div>{product.offers.map((item) => <OfferEditor key={item.id} offer={item} onSave={onOfferSave}/>)}</div></details>}</div>; })}{!products.length && <Empty>No matching products. Add a product to start the catalogue.</Empty>}</div></section>;
}

function OfferEditor({ offer, onSave }: { offer: AdminOffer; onSave: (id: string, payload: Omit<AdminOffer, "id" | "sellerSku" | "source" | "seller" | "reservedQuantity">) => void }) {
  const [price, setPrice] = useState(String(offer.price)); const [mrp, setMrp] = useState(String(offer.mrp ?? offer.price)); const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(String(offer.minimumOrderQuantity)); const [stockOnHand, setStockOnHand] = useState(String(offer.stockOnHand)); const [commissionRate, setCommissionRate] = useState(String(offer.commissionRate)); const [isActive, setIsActive] = useState(offer.isActive);
  return <form className="admin-offer-row" onSubmit={(event) => { event.preventDefault(); onSave(offer.id, { price: Number(price), mrp: Number(mrp), minimumOrderQuantity: Number(minimumOrderQuantity), stockOnHand: Number(stockOnHand), commissionRate: Number(commissionRate), isActive }); }}><span><b>{offer.seller.name}</b><small>{offer.source.replaceAll("_", " ")} · {offer.sellerSku} · {offer.reservedQuantity} reserved</small></span><label>Price<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)}/></label><label>MRP<input type="number" min="0" step="0.01" value={mrp} onChange={(event) => setMrp(event.target.value)}/></label><label>MOQ<input type="number" min="1" value={minimumOrderQuantity} onChange={(event) => setMinimumOrderQuantity(event.target.value)}/></label><label>Stock<input type="number" min={offer.reservedQuantity} value={stockOnHand} onChange={(event) => setStockOnHand(event.target.value)}/></label><label>Commission %<input type="number" min="0" max="100" step="0.01" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)}/></label><label className="admin-offer-active"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)}/> Active</label><button className="admin-secondary">Save</button></form>;
}

function OrganizationsPanel({ organizations, accounts, search, onSearch, onVerify, onAccountStatus }: { organizations: Organization[]; accounts: Account[]; search: string; onSearch: (value: string) => void; onVerify: (id: string, status: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION") => void; onAccountStatus: (id: string, status: "ACTIVE" | "DISABLED") => void }) {
  return <><section className="admin-panel"><PanelTitle title="Business verification" caption="Review organization details and approve marketplace access"/><div className="admin-toolbar"><label>⌕ <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search business or email…"/></label><span>{organizations.length} businesses</span></div><div className="admin-table-scroll"><table><thead><tr><th>Business</th><th>Contact</th><th>Accounts</th><th>Verification</th><th>Actions</th></tr></thead><tbody>{organizations.map((org) => <tr key={org.id}><td><b>{org.name}</b><small className="admin-table-sub">{org.type}</small></td><td>{org.email ?? "—"}<small className="admin-table-sub">{org.phone ?? ""}</small></td><td>{org._count.users}</td><td><Status value={org.verificationStatus}/>{org.verificationReason && <small className="admin-table-sub">{org.verificationReason}</small>}</td><td><div className="admin-actions"><button className="admin-approve" onClick={() => onVerify(org.id, "APPROVED")}>Approve</button>{org.verificationStatus !== "NEEDS_CORRECTION" && <button className="admin-secondary" onClick={() => onVerify(org.id, "NEEDS_CORRECTION")}>Request edits</button>}{org.verificationStatus !== "REJECTED" && <button className="admin-danger" onClick={() => onVerify(org.id, "REJECTED")}>Reject</button>}</div></td></tr>)}</tbody></table>{!organizations.length && <Empty>No businesses match this search.</Empty>}</div></section><section className="admin-panel admin-spaced"><PanelTitle title="Platform accounts" caption="Enable or disable sign-in for retailer or supplier accounts"/><div className="admin-table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Business</th><th>Account</th><th>Access</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><b>{account.name}</b></td><td>{account.email}</td><td>{account.organization?.name ?? "—"}</td><td><Status value={account.status}/></td><td><button className={account.status === "ACTIVE" ? "admin-danger" : "admin-approve"} onClick={() => onAccountStatus(account.id, account.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}>{account.status === "ACTIVE" ? "Disable" : "Enable"}</button></td></tr>)}</tbody></table>{!accounts.length && <Empty>No platform user accounts found.</Empty>}</div></section></>;
}

function OrdersPanel({ orders, search, onSearch, onStatus }: { orders: Order[]; search: string; onSearch: (value: string) => void; onStatus: (id: string, status: string) => void }) {
  const statuses = ["PLACED", "PARTIALLY_ACCEPTED", "ACCEPTED", "PARTIALLY_DISPATCHED", "DISPATCHED", "DELIVERED", "PARTIALLY_CANCELLED", "CANCELLED", "REJECTED"];
  return <section className="admin-panel"><div className="admin-toolbar"><label>⌕ <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search order number or retailer…"/></label><span>{orders.length} orders</span></div><div className="admin-table-scroll"><table><thead><tr><th>Order</th><th>Retailer</th><th>Fulfillment</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b>{order.orderNumber}</b><small className="admin-table-sub">{new Date(order.createdAt).toLocaleDateString()}</small></td><td>{order.retailer.name}</td><td>{order.fulfillments.flatMap((item) => item.lines).reduce((count, line) => count + line.quantity, 0)} items · {order.fulfillments.length} supplier(s)</td><td>{order.deliveryName}<small className="admin-table-sub">{order.deliveryDistrict}</small></td><td><b>{formatRupees(Number(order.total))}</b></td><td><select className="admin-status-select" value={order.status} onChange={(event) => onStatus(order.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{!orders.length && <Empty>No orders match this search.</Empty>}</div></section>;
}

function AllAccountsPanel({ accounts, search, onSearch, onAccountStatus }: { accounts: Account[]; search: string; onSearch: (value: string) => void; onAccountStatus: (id: string, status: "ACTIVE" | "DISABLED") => void }) {
  return <section className="admin-panel"><PanelTitle title="All platform accounts" caption="Search and control every user sign-in across retailer, supplier and operations roles"/><div className="admin-toolbar"><label>⌕ <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name, email, role, business…"/></label><span>{accounts.length} accounts</span></div><div className="admin-table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Business</th><th>Joined</th><th>Account</th><th>Access</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><b>{account.name}</b><small className="admin-table-sub">{account.email}{account.phone ? ` · ${account.phone}` : ""}</small></td><td>{account.role}</td><td>{account.organization?.name ?? "—"}</td><td>{new Date(account.createdAt).toLocaleDateString()}</td><td><Status value={account.status}/></td><td><button className={account.status === "ACTIVE" ? "admin-danger" : "admin-approve"} onClick={() => onAccountStatus(account.id, account.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}>{account.status === "ACTIVE" ? "Disable" : "Enable"}</button></td></tr>)}</tbody></table>{!accounts.length && <Empty>No user accounts match this search.</Empty>}</div></section>;
}

function CatalogPanel({ categories, brands, newCategory, newBrand, setNewCategory, setNewBrand, addNamed, setActive, onSaveBrand, busy }: { categories: Named[]; brands: Named[]; newCategory: string; newBrand: string; setNewCategory: (value: string) => void; setNewBrand: (value: string) => void; addNamed: (kind: "categories" | "brands", name: string, clear: () => void) => void; setActive: (kind: "categories" | "brands", id: string, active: boolean) => void; onSaveBrand: (id: string, details: { name: string; description: string; imageUrl: string }, file?: File) => void; busy: boolean }) {
  return <div className="admin-catalog-layout"><section className="admin-panel"><PanelTitle title="Categories" caption="Manage the catalogue groups"/><form className="admin-add-inline" onSubmit={(event) => { event.preventDefault(); if (newCategory.trim()) addNamed("categories", newCategory.trim(), () => setNewCategory("")); }}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category name"/><button className="admin-primary">+ Add</button></form>{categories.map((item) => <div className="admin-catalog-row" key={item.id}><span>?</span><b>{item.name}</b><small>{item._count?.products ?? 0} products</small><button className="admin-catalog-toggle" onClick={() => setActive("categories", item.id, !item.isActive)}>{item.isActive ? "Disable" : "Enable"}</button></div>)}</section><section className="admin-panel admin-brand-management"><PanelTitle title="Brand identity" caption="Upload a logo, edit the brand name and add a short description. Saved changes appear on the public homepage."/><form className="admin-add-inline" onSubmit={(event) => { event.preventDefault(); if (newBrand.trim()) addNamed("brands", newBrand.trim(), () => setNewBrand("")); }}><input value={newBrand} onChange={(event) => setNewBrand(event.target.value)} placeholder="Add a new brand name"/><button className="admin-primary">+ Add brand</button></form>{brands.length ? <div className="admin-brand-editor-list">{brands.map((brand) => <BrandEditor key={brand.id + "-" + brand.name + "-" + (brand.imageUrl ?? "") + "-" + (brand.description ?? "")} brand={brand} busy={busy} onSave={onSaveBrand}/>)}</div> : <Empty>Add a brand to create its homepage card.</Empty>}</section></div>;
}

function BrandEditor({ brand, busy, onSave }: { brand: Named; busy: boolean; onSave: (id: string, details: { name: string; description: string; imageUrl: string }, file?: File) => void }) {
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description ?? "");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const imageUrl = preview || (brand.imageUrl ? (brand.imageUrl.startsWith("http") ? brand.imageUrl : API_ORIGIN + brand.imageUrl) : "");
  return <form className="admin-brand-editor" onSubmit={(event) => { event.preventDefault(); onSave(brand.id, { name: name.trim(), description: description.trim(), imageUrl: brand.imageUrl ?? "" }, file); }}><div className="admin-brand-editor-image">{imageUrl ? <Image src={imageUrl} alt={name + " logo preview"} width={88} height={88} unoptimized/> : <b>{name.slice(0, 1).toUpperCase()}</b>}</div><div className="admin-brand-editor-fields"><div className="admin-brand-editor-row"><label>Brand name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)}/></label><label>Brand description<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description for shoppers"/></label></div><div className="admin-brand-editor-actions"><label className="admin-home-card-picker">{file ? "Change selected logo" : "Choose logo image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const selected = event.currentTarget.files?.[0]; if (!selected) return; if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(selected.type) || selected.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG, WebP, or AVIF image under 5 MB"); return; } setError(""); setFile(selected); setPreview(URL.createObjectURL(selected)); }}/></label><button className="admin-primary" disabled={busy}>{busy ? "Saving..." : "Save brand"}</button><small>{file?.name ?? "JPG, PNG, WebP, or AVIF ? max 5 MB"}</small></div>{error && <small className="admin-brand-error">{error}</small>}</div></form>;
}

function ProductEditor({ form, setForm, categories, brands, editing, imagePreview, busy, onImage, onClose, onSubmit }: { form: ProductForm; setForm: (value: ProductForm) => void; categories: Named[]; brands: Named[]; editing: AdminProduct | null; imagePreview: string; busy: boolean; onImage: (event: ChangeEvent<HTMLInputElement>) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const change = (key: keyof ProductForm, value: string) => setForm({ ...form, [key]: value });
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-title"><header><div><span className="admin-eyebrow">CATALOGUE MANAGEMENT</span><h2 id="admin-product-title">{editing ? "Edit product" : "Add product"}</h2></div><button onClick={onClose} aria-label="Close">×</button></header><form onSubmit={onSubmit}><div className="admin-form-layout"><div className="admin-image-upload"><div>{imagePreview ? <Image src={imagePreview} alt="Product preview" fill unoptimized/> : <span>▧</span>}</div><label className="admin-secondary">Upload product image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onImage}/></label><small>JPG, PNG, WebP or AVIF · max 5 MB</small></div><div className="admin-form-fields"><label>Product name<input required maxLength={160} value={form.name} onChange={(event) => change("name", event.target.value)} placeholder="e.g. Premium NPK Fertilizer"/></label><div className="admin-form-row"><label>Category<select required value={form.categoryId} onChange={(event) => change("categoryId", event.target.value)}><option value="">Select category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Brand<select value={form.brandId} onChange={(event) => change("brandId", event.target.value)}><option value="">No brand</option>{brands.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><label>Description<textarea rows={3} maxLength={2000} value={form.description} onChange={(event) => change("description", event.target.value)} placeholder="Product details"/></label><div className="admin-form-row"><label>Pack size<input required value={form.packSize} onChange={(event) => change("packSize", event.target.value)} placeholder="1"/></label><label>Unit<input required value={form.unit} onChange={(event) => change("unit", event.target.value)} placeholder="kg bag"/></label></div><div className="admin-form-row"><label>Selling price (₹)<input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => change("price", event.target.value)}/></label><label>MRP (₹)<input required type="number" min="0" step="0.01" value={form.mrp} onChange={(event) => change("mrp", event.target.value)}/></label></div><div className="admin-form-row"><label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(event) => change("taxRate", event.target.value)}/></label><label>Minimum order qty<input required type="number" min="1" value={form.minimumOrderQuantity} onChange={(event) => change("minimumOrderQuantity", event.target.value)}/></label></div><div className="admin-form-row"><label>SKU<input required maxLength={80} value={form.sellerSku} onChange={(event) => change("sellerSku", event.target.value)}/></label><label>Available stock<input required type="number" min="0" value={form.stockOnHand} onChange={(event) => change("stockOnHand", event.target.value)}/></label></div><label>Catalogue status<select value={form.status} onChange={(event) => change("status", event.target.value as ProductStatus)}>{["APPROVED", "DRAFT", "PENDING_REVIEW", "REJECTED", "ARCHIVED"].map((status) => <option key={status}>{status}</option>)}</select></label></div></div><footer><button type="button" className="admin-secondary" onClick={onClose}>Cancel</button><button type="submit" className="admin-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save product" : "Create product"}</button></footer></form></section></div>;
}

function ProductThumb({ image, name }: { image: string | null; name: string }) { return <span className="admin-product-thumb">{image ? <Image src={`${API_ORIGIN}${image}`} alt="" fill unoptimized/> : <b>{name.slice(0, 1)}</b>}</span>; }
function Status({ value }: { value: string }) { return <span className={`admin-status status-${value.toLowerCase().replaceAll("_", "-")}`}>{value.replaceAll("_", " ")}</span>; }
function PanelTitle({ title, caption, action, onAction }: { title: string; caption?: string; action?: string; onAction?: () => void }) { return <div className="admin-panel-title"><div><h2>{title}</h2>{caption && <p>{caption}</p>}</div>{action && <button onClick={onAction}>{action} →</button>}</div>; }
function Empty({ children }: { children: ReactNode }) { return <div className="admin-empty">{children}</div>; }
