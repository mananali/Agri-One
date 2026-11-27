import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { apiRequest, ApiRequestError, type Offer, type Product, type Session, type User, type Organization } from "./api";
import { demoCategories, demoProducts } from "./demo-catalog";

const TOKEN_KEY = "agri-one-session-token";
const CART_KEY = "agri-one-retailer-cart";
const SAVED_KEY = "agri-one-saved-products";
const RECENTLY_VIEWED_KEY = "agri-one-recently-viewed";

export type CartLine = { offerId: string; productId: string; slug: string; name: string; brand: string; pack: string; categorySlug: string; imageUrl?: string | null; price: number; quantity: number; minimumOrderQuantity: number; stock: number };
export type Promotion = { id: string; title: string; body: string; startsAt: string; endsAt: string; type: "FESTIVAL" | "BULK" | "REWARDS"; discountPercent: number | string | null; minimumOrderQuantity: number | null; coinsPer100: number };
export type InboxNotification = { id: string; readAt: string | null; notification: { id: string; title: string; body: string; createdAt: string } };
type StoreValue = {
  token: string | null;
  user: User | null;
  organization: Organization;
  products: Product[];
  categories: Array<{ id: string; name: string; slug: string }>;
  promotions: Promotion[];
  notifications: InboxNotification[];
  cart: CartLine[];
  savedProductIds: string[];
  recentlyViewedIds: string[];
  loadingSession: boolean;
  loadingCatalog: boolean;
  catalogError: string;
  loadCatalog: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithTestPhone: (phoneNumber: string) => Promise<void>;
  register: (details: { name: string; email: string; password: string; phone?: string; organizationName: string; accountType: "RETAILER" | "SUPPLIER" }) => Promise<void>;
  updateProfile: (details: { name: string; organizationName?: string; phone: string | null; businessEntityType?: "PROPRIETOR" | "PRIVATE_LIMITED" | "PARTNERSHIP" }) => Promise<void>;
  signOut: () => Promise<void>;
  addToCart: (product: Product, offer: Offer, quantity?: number) => void;
  updateQuantity: (offerId: string, quantity: number) => void;
  removeFromCart: (offerId: string) => void;
  clearCart: () => void;
  toggleSavedProduct: (productId: string) => void;
  recordRecentlyViewed: (productId: string) => void;
};
const StoreContext = createContext<StoreValue | null>(null);

async function readToken() {
  if (Platform.OS === "web") return typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}
async function saveToken(token: string) {
  if (Platform.OS === "web") { localStorage.setItem(TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
async function deleteToken() {
  if (Platform.OS === "web") { localStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AppStore({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreValue["categories"]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const hasLiveCatalog = useRef(false);

  const acceptSession = useCallback(async (session: Session) => {
    await saveToken(session.accessToken);
    setToken(session.accessToken);
    setUser(session.user);
    setOrganization(session.organization);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([readToken().catch(() => null), AsyncStorage.getItem(CART_KEY).catch(() => null), AsyncStorage.getItem(SAVED_KEY).catch(() => null), AsyncStorage.getItem(RECENTLY_VIEWED_KEY).catch(() => null)]).then(async ([savedToken, savedCart, savedProducts, savedRecent]) => {
      if (!active) return;
      if (savedCart) {
        try { setCart(JSON.parse(savedCart) as CartLine[]); } catch { await AsyncStorage.removeItem(CART_KEY); }
      }
      if (savedProducts) { try { setSavedProductIds(JSON.parse(savedProducts) as string[]); } catch { await AsyncStorage.removeItem(SAVED_KEY); } }
      if (savedRecent) { try { setRecentlyViewedIds(JSON.parse(savedRecent) as string[]); } catch { await AsyncStorage.removeItem(RECENTLY_VIEWED_KEY); } }
      if (savedToken) {
        try {
          const current = await apiRequest<{ user: User; organization: Organization }>("/auth/me", savedToken);
          if (active) { setToken(savedToken); setUser(current.user); setOrganization(current.organization); }
        } catch (cause) {
          // Keep a valid saved session through a network or server outage. Only an explicit
          // authentication failure means the token should be removed.
          if (active && cause instanceof ApiRequestError && cause.status === 401) {
            await deleteToken().catch(() => undefined);
          } else if (active) {
            setToken(savedToken);
          }
        }
      }
    }).finally(() => { if (active) { setLoadingSession(false); setStorageReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (storageReady) void AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => undefined);
  }, [cart, storageReady]);
  useEffect(() => { if (storageReady) void AsyncStorage.setItem(SAVED_KEY, JSON.stringify(savedProductIds)).catch(() => undefined); }, [savedProductIds, storageReady]);
  useEffect(() => { if (storageReady) void AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewedIds)).catch(() => undefined); }, [recentlyViewedIds, storageReady]);

  const loadCatalog = useCallback(async (silent = false) => {
    if (!silent) setLoadingCatalog(true);
    setCatalogError("");
    try {
      const [firstPage, categoryList, promotionList] = await Promise.all([
        apiRequest<{ data: Product[]; pagination?: { totalPages: number } }>("/catalog/products?page=1&pageSize=100"),
        apiRequest<StoreValue["categories"]>("/catalog/categories"),
        apiRequest<Promotion[]>("/catalog/promotions"),
      ]);
      const totalPages = Math.max(1, firstPage.pagination?.totalPages ?? 1);
      const laterPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => apiRequest<{ data: Product[] }>(`/catalog/products?page=${index + 2}&pageSize=100`)));
      const liveProducts = [firstPage, ...laterPages].flatMap(page => page.data);
      hasLiveCatalog.current = true;
      setProducts(liveProducts);
      setCart(previous => previous.flatMap(line => {
        const product = liveProducts.find(item => item.id === line.productId);
        const offer = product?.offers.find(item => item.id === line.offerId);
        if (!product || !offer) return [];
        const quantity = Math.min(line.quantity, offer.availableStock);
        if (quantity < offer.minimumOrderQuantity) return [];
        return [{ ...line, slug: product.slug, name: product.name, brand: product.brand?.name ?? offer.seller?.name ?? "Agri-One", pack: [product.packSize, product.unit].filter(Boolean).join(" "), categorySlug: product.category.slug, imageUrl: product.imageUrl, price: Number(offer.price), quantity, minimumOrderQuantity: offer.minimumOrderQuantity, stock: offer.availableStock }];
      }));
      setCategories([{ id: "all", name: "All products", slug: "" }, ...categoryList]);
      setPromotions(promotionList);
      if (liveProducts.length === 0) setCatalogError("No approved products are available yet.");
    } catch (error) {
      if (!hasLiveCatalog.current) {
        setProducts(demoProducts);
        setCategories([{ id: "all", name: "All products", slug: "" }, ...demoCategories]);
        setPromotions([]);
        setCatalogError(error instanceof Error ? `Showing sample listings. ${error.message}` : "Showing sample listings while the live catalogue is unavailable.");
      } else {
        setCatalogError(error instanceof Error ? `Live catalogue could not refresh. Showing the last loaded products. ${error.message}` : "Live catalogue could not refresh. Showing the last loaded products.");
      }
    } finally { if (!silent) setLoadingCatalog(false); }
  }, []);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  useEffect(() => {
    if (!token) { setNotifications([]); return; }
    let active = true;
    const refresh = () => void apiRequest<InboxNotification[]>("/notifications", token).then((items) => { if (active) setNotifications(items); }).catch(() => undefined);
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    let inFlight = false;
    const refreshSession = async () => {
      if (!active || inFlight || (AppState.currentState !== null && AppState.currentState !== "active")) return;
      inFlight = true;
      try {
        const current = await apiRequest<{ user: User; organization: Organization }>("/auth/me", token);
        if (active) { setUser(current.user); setOrganization(current.organization); }
      } catch (cause) {
        if (active && cause instanceof ApiRequestError && cause.status === 401) {
          await deleteToken().catch(() => undefined);
          setToken(null);
          setUser(null);
          setOrganization(null);
        }
      } finally {
        inFlight = false;
      }
    };
    void refreshSession();
    const timer = setInterval(() => void refreshSession(), 30_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refreshSession(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => { if (AppState.currentState === "active") void loadCatalog(true); }, 30_000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void loadCatalog(true); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [loadCatalog]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await apiRequest<Session>("/auth/login", null, { method: "POST", body: JSON.stringify({ email, password }) });
    await acceptSession(session);
  }, [acceptSession]);

  const signInWithTestPhone = useCallback(async (phoneNumber: string) => {
    const session = await apiRequest<Session>("/auth/test-retailer-login", null, { method: "POST", body: JSON.stringify({ phoneNumber }) });
    await acceptSession(session);
  }, [acceptSession]);

  const register = useCallback(async (details: { name: string; email: string; password: string; phone?: string; organizationName: string; accountType: "RETAILER" | "SUPPLIER" }) => {
    const session = await apiRequest<Session>("/auth/register", null, { method: "POST", body: JSON.stringify({ ...details, phone: details.phone || undefined }) });
    await acceptSession(session);
  }, [acceptSession]);

  const updateProfile = useCallback(async (details: { name: string; organizationName?: string; phone: string | null; businessEntityType?: "PROPRIETOR" | "PRIVATE_LIMITED" | "PARTNERSHIP" }) => {
    if (!token) throw new Error("Sign in to update your business profile.");
    const current = await apiRequest<{ user: User; organization: Organization }>("/auth/me", token, { method: "PATCH", body: JSON.stringify(details) });
    setUser(current.user);
    setOrganization(current.organization);
  }, [token]);

  const signOut = useCallback(async () => { await deleteToken(); setToken(null); setUser(null); setOrganization(null); }, []);
  const markNotificationRead = useCallback(async (id: string) => {
    if (!token) return;
    await apiRequest(`/notifications/${id}/read`, token, { method: "PATCH" });
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }, [token]);
  const addToCart = useCallback((product: Product, offer: Offer, requestedQuantity?: number) => {
    setCart(previous => {
      const existing = previous.find(line => line.offerId === offer.id);
      const quantity = Math.min((existing?.quantity ?? 0) + Math.max(offer.minimumOrderQuantity, requestedQuantity ?? offer.minimumOrderQuantity), offer.availableStock);
      if (quantity < offer.minimumOrderQuantity) return previous;
      const line: CartLine = { offerId: offer.id, productId: product.id, slug: product.slug, name: product.name, brand: product.brand?.name ?? offer.seller?.name ?? "Agri-One", pack: [product.packSize, product.unit].filter(Boolean).join(" "), categorySlug: product.category.slug, imageUrl: product.imageUrl, price: Number(offer.price), quantity, minimumOrderQuantity: offer.minimumOrderQuantity, stock: offer.availableStock };
      return existing ? previous.map(item => item.offerId === offer.id ? { ...line } : item) : [...previous, line];
    });
  }, []);
  const updateQuantity = useCallback((offerId: string, quantity: number) => setCart(previous => previous.map(line => line.offerId === offerId ? { ...line, quantity: Math.max(line.minimumOrderQuantity, Math.min(line.stock, quantity)) } : line)), []);
  const removeFromCart = useCallback((offerId: string) => setCart(previous => previous.filter(line => line.offerId !== offerId)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const toggleSavedProduct = useCallback((productId: string) => setSavedProductIds(previous => previous.includes(productId) ? previous.filter(id => id !== productId) : [...previous, productId]), []);
  const recordRecentlyViewed = useCallback((productId: string) => setRecentlyViewedIds(previous => [productId, ...previous.filter(id => id !== productId)].slice(0, 12)), []);

  const value = useMemo(() => ({ token, user, organization, products, categories, promotions, notifications, cart, savedProductIds, recentlyViewedIds, loadingSession, loadingCatalog, catalogError, loadCatalog, markNotificationRead, signIn, signInWithTestPhone, register, updateProfile, signOut, addToCart, updateQuantity, removeFromCart, clearCart, toggleSavedProduct, recordRecentlyViewed }), [token, user, organization, products, categories, promotions, notifications, cart, savedProductIds, recentlyViewedIds, loadingSession, loadingCatalog, catalogError, loadCatalog, markNotificationRead, signIn, signInWithTestPhone, register, updateProfile, signOut, addToCart, updateQuantity, removeFromCart, clearCart, toggleSavedProduct, recordRecentlyViewed]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppStore");
  return store;
}
