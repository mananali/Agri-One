import Constants from "expo-constants";
import { Platform } from "react-native";

const fallbackHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const configuredApiBase = process.env.EXPO_PUBLIC_API_URL?.trim();

function isLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" ||
    host.startsWith("10.") || host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function getDevelopmentApiBase() {
  if (!__DEV__) return null;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (!hostname) return null;
    if (hostname.endsWith(".exp.direct")) return `https://${hostname.replace(/\.exp\.direct$/, "-3001.exp.direct")}/api/v1`;
    return `http://${hostname}:3001/api/v1`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  try {
    const hostname = new URL(`http://${hostUri}`).hostname;
    if (hostname.endsWith(".exp.direct")) return `https://${hostname.replace(/\.exp\.direct$/, "-3001.exp.direct")}/api/v1`;
    // Expo's other public tunnel hosts do not expose the API port this way.
    if (hostname.endsWith(".expo.dev")) return null;
    if (Platform.OS === "android" && (hostname === "localhost" || hostname === "127.0.0.1")) return "http://10.0.2.2:3001/api/v1";
    return `http://${hostname}:3001/api/v1`;
  } catch {
    return null;
  }
}

const discoveredApiBase = getDevelopmentApiBase();
let configuredHostIsLocal = false;
if (configuredApiBase) {
  try { configuredHostIsLocal = isLocalHost(new URL(configuredApiBase).hostname); } catch { configuredHostIsLocal = false; }
}
// A local .env address can become stale when the laptop changes networks. In development,
// use the host that currently serves the app; explicit non-local API URLs remain respected.
const selectedApiBase = __DEV__ && discoveredApiBase && (!configuredApiBase || configuredHostIsLocal)
  ? discoveredApiBase
  : configuredApiBase ?? `http://${fallbackHost}:3001/api/v1`;
export const API_BASE = selectedApiBase.replace(/\/$/, "");
export const API_ORIGIN = new URL(API_BASE).origin;

export class ApiRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export type User = { id: string; name: string; email: string; phone: string | null; phoneVerified?: boolean; role: "RETAILER" | "SUPPLIER" | "ADMIN" };
export type Organization = { id: string; name: string; type: "RETAILER" | "SUPPLIER"; businessEntityType?: "PROPRIETOR" | "PRIVATE_LIMITED" | "PARTNERSHIP" | null; verificationStatus: string; email?: string | null; phone?: string | null } | null;
export type Session = { accessToken: string; user: User; organization: Organization };
export type Offer = {
  id: string;
  source?: "MARKETPLACE" | "AGRI_ONE_STOCK";
  price: number | string;
  mrp?: number | string | null;
  availableStock: number;
  minimumOrderQuantity: number;
  seller?: { id?: string; name: string };
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  packSize?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  category: { name: string; slug: string };
  brand?: { name: string } | null;
  offers: Offer[];
};
export type MobileHomeTopSelling = { enabled: boolean; title: string; subtitle: string; products: Product[] };
export type CatalogBrand = { id: string; name: string; slug: string; description?: string | null; imageUrl?: string | null };
export type CatalogCategory = { id: string; name: string; slug: string; description?: string | null };
export type OrganizationRecord = { id: string; name: string; email?: string | null; type: string; verificationStatus: string };
export type ComplianceDocument = { id: string; documentType: string; originalName: string; reviewStatus: string; reviewReason: string | null; createdAt: string };
export type DeliveryAddress = { id: string; label: string; recipientName: string; phone: string; address: string; area: string; district: string; pinCode: string; isDefault: boolean; createdAt: string; updatedAt: string };
export type Wallet = { id: string; balance: number | string; coinBalance: number; transactions: Array<{ id: string; type: "CREDIT" | "DEBIT"; amount: number | string; coinDelta: number; description: string; createdAt: string }> };
export type CertificateApplication = { id: string; certificate: string; purpose: string | null; status: string; reviewReason: string | null; createdAt: string; updatedAt: string };
export type RetailerBusinessProfile = { gstin: string; panNumber: string; bankAccountName: string; bankAccountNumber: string; bankIfsc: string; verificationStatus: string; isLocked: boolean };
export type RetailerStock = { id: string; quantity: number; lowStockThreshold: number; updatedAt: string; product: { id: string; name: string; slug: string; imageUrl?: string | null; packSize: string; unit: string; category: { name: string } } };
export type SupportTicket = { id: string; subject: string; message: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; adminReply?: string | null; createdAt: string; updatedAt: string };
export type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod?: string | null;
  payments?: Array<{ id: string; amount: number | string; status: string; provider?: string | null; createdAt?: string }>;
  total: number | string;
  createdAt: string;
  deliveryName?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;
  deliveryArea?: string;
  deliveryDistrict?: string;
  deliveryPinCode?: string;
  fulfillments?: Array<{
    id: string;
    status: string;
    lines: Array<{
      id: string;
      offerId: string;
      productNameSnapshot: string;
      skuSnapshot: string;
      quantity: number;
      unitPriceSnapshot: number | string;
      lineTotal: number | string;
      taxAmount?: number | string;
      imageUrl?: string | null;
      offer?: { product?: { imageUrl?: string | null } };
    }>;
  }>;
  returnRequests?: Array<{ id: string; status: string; reason: string; reviewReason?: string | null; requestedAt: string }>;
};

export function imageSource(path?: string | null) {
  if (!path) return undefined;
  return { uri: path.startsWith("http") ? path : `${API_ORIGIN}${path}` };
}

export async function apiRequest<T>(path: string, token?: string | null, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const isMultipart = typeof FormData !== "undefined" && init.body instanceof FormData;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: !init.method || init.method.toUpperCase() === "GET" ? "no-store" : init.cache,
      headers: {
        Accept: "application/json",
        ...(init.body && !isMultipart ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiRequestError(`Can't reach Agri-One API at ${API_BASE}. Check that the backend is running and the phone can reach this address.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    throw new ApiRequestError(message || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export const money = (value: number | string) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
