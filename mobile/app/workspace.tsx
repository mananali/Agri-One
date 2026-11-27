import { AgriText as Text } from "../components/AgriText";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Field, Panel } from "../components/Controls";
import { API_BASE, apiRequest, money, type CatalogCategory, type OrganizationRecord, type Product, type User } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

type Page<T> = { data: T[] };
type SupplierOrder = { id: string; status: string; fulfillmentNumber: string; total: number | string; createdAt: string; customerOrder: { orderNumber: string; deliveryDistrict: string; deliveryPinCode: string; createdAt: string }; lines: Array<{ id: string; productNameSnapshot: string; quantity: number }> };
type AdminOverview = { users: number; retailers: number; suppliers: number; products: number; pendingProducts: number; orders: number; pendingOrganizations: number; revenue: number };
type AdminUser = { id: string; name: string; email: string; role: string; status: string; organization: { name: string } | null };
type AdminOrder = { id: string; orderNumber: string; status: string; total: number | string; retailer: { name: string } };
const ADMIN_PANEL_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? `${API_BASE.replace(/\/api\/v1\/?$/, "").replace(":3001", ":3000")}/admin`;

function SupplierStockCard({ offerId, name, available, token, onUpdated }: { offerId: string; name: string; available: number; token: string; onUpdated: () => void }) {
  const [quantity, setQuantity] = useState(String(available));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function saveStock() {
    if (!reason.trim()) { Alert.alert("Add a reason", "A short reason is required for the stock adjustment."); return; }
    setSaving(true);
    try { await apiRequest(`/supplier/offers/${offerId}/stock`, token, { method: "PATCH", body: JSON.stringify({ stockOnHand: Math.max(0, Number(quantity) || 0), reason: reason.trim() }) }); setReason(""); Alert.alert("Stock updated", "The new stock count has been saved."); onUpdated(); }
    catch (cause) { Alert.alert("Could not update stock", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setSaving(false); }
  }
  return <Panel style={styles.record}><Text style={styles.recordName}>{name}</Text><Text style={styles.meta}>Available stock: {available}</Text><View style={styles.row}><View style={styles.half}><Field label="New stock count" keyboardType="number-pad" value={quantity} onChangeText={setQuantity}/></View><View style={styles.half}><Field label="Reason" placeholder="Stock received" value={reason} onChangeText={setReason}/></View></View><Button title="Save stock" loading={saving} onPress={() => void saveStock()}/></Panel>;
}

export default function WorkspaceScreen() {
  const { token, user, organization, categories, products, loadCatalog } = useAppStore();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [posting, setPosting] = useState(false);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [packSize, setPackSize] = useState("");
  const [unit, setUnit] = useState("pack");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minimum, setMinimum] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [brandName, setBrandName] = useState("");

  const load = useCallback(async () => {
    if (!token || !user) { setBusy(false); return; }
    setBusy(true); setError("");
    try {
      if (user.role === "SUPPLIER") {
        const result = await apiRequest<SupplierOrder[]>("/orders", token);
        setOrders(result);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your workspace."); }
    finally { setBusy(false); }
  }, [token, user]);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]));
  useEffect(() => { if (!categoryId && categories.length) setCategoryId(categories.find(item => item.slug)?.id ?? ""); }, [categories, categoryId]);

  async function reviewOrganization(id: string, status: "APPROVED" | "NEEDS_CORRECTION") {
    try { await apiRequest(`/admin/organizations/${id}/verification`, token, { method: "PATCH", body: JSON.stringify({ status, reason: status === "APPROVED" ? undefined : "Please provide the required business documents." }) }); await load(); }
    catch (cause) { Alert.alert("Could not update verification", cause instanceof Error ? cause.message : "Please try again."); }
  }
  async function reviewProduct(id: string, status: "APPROVED" | "REJECTED") {
    try { await apiRequest(`/admin/products/${id}/review`, token, { method: "PATCH", body: JSON.stringify({ status, reason: status === "REJECTED" ? "Please review the listing details." : undefined }) }); await load(); }
    catch (cause) { Alert.alert("Could not review product", cause instanceof Error ? cause.message : "Please try again."); }
  }
  async function setAccountStatus(id: string, status: "ACTIVE" | "DISABLED") {
    try { await apiRequest(`/admin/users/${id}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (cause) { Alert.alert("Could not update account", cause instanceof Error ? cause.message : "Please try again."); }
  }
  async function setOrderStatus(id: string, status: string) {
    try { await apiRequest(`/admin/orders/${id}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (cause) { Alert.alert("Could not update order", cause instanceof Error ? cause.message : "Please try again."); }
  }
  async function decideOrder(id: string, decision: "ACCEPT" | "REJECT") {
    try { await apiRequest(`/orders/fulfillments/${id}/decision`, token, { method: "PATCH", body: JSON.stringify({ decision, ...(decision === "REJECT" ? { reason: "Unable to fulfil this order." } : {}) }) }); await load(); }
    catch (cause) { Alert.alert("Could not update order", cause instanceof Error ? cause.message : "Please try again."); }
  }
  async function submitProduct() {
    if (!token || !productName.trim() || !categoryId || !packSize.trim() || !sku.trim() || Number(price) < 0 || !Number.isFinite(Number(price))) { Alert.alert("Complete product details", "Add a name, category, pack, SKU and a valid price."); return; }
    setPosting(true);
    try {
      const path = isAdmin ? "/admin/products" : "/supplier/products";
      const payload = { name: productName.trim(), categoryId, description: description.trim() || undefined, packSize: packSize.trim(), unit: unit.trim() || "pack", sellerSku: sku.trim(), minimumOrderQuantity: Math.max(1, Number(minimum) || 1), initialStock: Math.max(0, Number(stock) || 0), price: Number(price) };
      await apiRequest(path, token, { method: "POST", body: JSON.stringify(payload) });
      Alert.alert(isAdmin ? "Product created" : "Submitted for review", isAdmin ? "The Agri-One product has been added to the catalogue." : "Your product listing is waiting for admin approval."); setProductName(""); setDescription(""); setPackSize(""); setSku(""); setPrice(""); setStock(""); await loadCatalog(); await load();
    } catch (cause) { Alert.alert("Could not submit listing", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setPosting(false); }
  }
  async function createCatalogRecord(kind: "categories" | "brands", name: string, clear: (value: string) => void) {
    if (!name.trim()) { Alert.alert("Enter a name", "Add a name before saving this catalogue item."); return; }
    try { await apiRequest(`/admin/${kind}`, token, { method: "POST", body: JSON.stringify({ name: name.trim() }) }); clear(""); Alert.alert("Saved", `The ${kind.slice(0, -1)} has been created.`); await loadCatalog(); }
    catch (cause) { Alert.alert("Could not save", cause instanceof Error ? cause.message : "Please try again."); }
  }

  if (!token || !user) return <SafeAreaView style={styles.safe} edges={["top"]}><EmptyState title="Sign in to open your workspace" detail="Retailer, supplier and admin tools are available after signing in." action={<Button title="Sign in" onPress={() => router.push("/login")}/>}/></SafeAreaView>;
  if (busy) return <SafeAreaView style={styles.safe} edges={["top"]}><ActivityIndicator color={colors.green} style={{ marginTop: 50 }}/></SafeAreaView>;
  const isSupplier = user.role === "SUPPLIER";
  const isAdmin = user.role === "ADMIN";
  const ownOffers = isSupplier && organization ? products.flatMap(product => product.offers.filter(offer => offer.seller?.id === organization.id).map(offer => ({ product, offer }))) : [];
  if (isAdmin) return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>AGRI-ONE ADMIN</Text><Text style={styles.title}>Centralized Admin Panel</Text><Text style={styles.meta}>Use the same full admin dashboard on mobile and desktop. Sign in again in your browser to continue securely.</Text><Panel style={styles.form}><Button title="Open Central Admin Panel" onPress={() => { void Linking.openURL(ADMIN_PANEL_URL).catch(() => Alert.alert("Could not open admin panel", `Check the admin website address: ${ADMIN_PANEL_URL}`)); }}/><Text style={styles.meta}>Admin website: {ADMIN_PANEL_URL}</Text></Panel></ScrollView></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>{isAdmin ? "ADMINISTRATION" : isSupplier ? "SUPPLIER PORTAL" : "RETAILER ACCOUNT"}</Text>
    <Text style={styles.title}>{isAdmin ? "Operations" : isSupplier ? "Supplier workspace" : "Business workspace"}</Text>
    <Text style={styles.subtitle}>{organization?.name ?? user.name} · {user.email}</Text>
    {!!error && <Panel style={styles.errorPanel}><Text style={styles.error}>{error}</Text><Button title="Try again" variant="outline" onPress={load}/></Panel>}
    {isAdmin && overview && <><Text style={styles.sectionTitle}>Platform overview</Text><View style={styles.stats}>{[["Retailers", overview.retailers], ["Suppliers", overview.suppliers], ["Products", overview.products], ["Orders", overview.orders]].map(([label, value]) => <Panel key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Panel>)}</View><Panel style={styles.summary}><Text style={styles.summaryTitle}>Needs review</Text><Text style={styles.summaryText}>{overview.pendingOrganizations} businesses · {overview.pendingProducts} products</Text><Text style={styles.summaryText}>Confirmed order revenue: {money(overview.revenue)}</Text></Panel>
      <Text style={styles.sectionTitle}>Business verification</Text>{organizations.length ? organizations.map(org => <Panel key={org.id} style={styles.record}><View style={styles.recordTop}><Text style={styles.recordName}>{org.name}</Text><Text style={styles.status}>{org.type}</Text></View><Text style={styles.meta}>{org.email ?? "No email"} · {org.verificationStatus.replaceAll("_", " ")}</Text><View style={styles.actions}><Button title="Approve" onPress={() => void reviewOrganization(org.id, "APPROVED")} style={styles.action}/><Button title="Needs correction" variant="outline" onPress={() => void reviewOrganization(org.id, "NEEDS_CORRECTION")} style={styles.action}/></View></Panel>) : <Text style={styles.muted}>No businesses are waiting for review.</Text>}
      <Text style={styles.sectionTitle}>Product approvals</Text>{pendingProducts.length ? pendingProducts.map(product => <Panel key={product.id} style={styles.record}><Text style={styles.recordName}>{product.name}</Text><Text style={styles.meta}>{product.category.name} · {product.brand?.name ?? "No brand"}</Text><View style={styles.actions}><Button title="Approve" onPress={() => void reviewProduct(product.id, "APPROVED")} style={styles.action}/><Button title="Reject" variant="outline" onPress={() => void reviewProduct(product.id, "REJECTED")} style={styles.action}/></View></Panel>) : <Text style={styles.muted}>No products are waiting for approval.</Text>}
    </>}
    {isAdmin && <><Text style={styles.sectionTitle}>Manage accounts</Text>{adminUsers.map(item => <Panel key={item.id} style={styles.record}><Text style={styles.recordName}>{item.name}</Text><Text style={styles.meta}>{item.email} · {item.role} · {item.status}</Text><Button disabled={item.id === user.id} title={item.status === "ACTIVE" ? "Disable account" : "Enable account"} variant="outline" onPress={() => void setAccountStatus(item.id, item.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}/></Panel>)}<Text style={styles.sectionTitle}>Recent orders</Text>{adminOrders.map(item => <Panel key={item.id} style={styles.record}><View style={styles.recordTop}><Text style={styles.recordName}>{item.orderNumber}</Text><Text style={styles.status}>{item.status.replaceAll("_", " ")}</Text></View><Text style={styles.meta}>{item.retailer.name} · {money(item.total)}</Text><View style={styles.categoryOptions}>{(["ACCEPTED", "DISPATCHED", "DELIVERED", "CANCELLED"] as const).map(status => <Text key={status} onPress={() => void setOrderStatus(item.id, status)} style={styles.categoryOption}>{status}</Text>)}</View></Panel>)}<Text style={styles.sectionTitle}>Add catalogue records</Text><Panel style={styles.form}><Field label="New category" placeholder="Category name" value={categoryName} onChangeText={setCategoryName}/><Button title="Create category" variant="outline" onPress={() => void createCatalogRecord("categories", categoryName, setCategoryName)}/><Field label="New brand" placeholder="Brand name" value={brandName} onChangeText={setBrandName}/><Button title="Create brand" variant="outline" onPress={() => void createCatalogRecord("brands", brandName, setBrandName)}/></Panel></>}
    {isAdmin && <><Text style={styles.sectionTitle}>Create Agri-One product</Text><Panel style={styles.form}><Field label="Product name" placeholder="Product name" value={productName} onChangeText={setProductName}/><Field label="Description" placeholder="Product details" value={description} onChangeText={setDescription} multiline/><Text style={styles.label}>Category</Text><View style={styles.categoryOptions}>{categories.filter(item => item.slug).map(category => <Text key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.categoryOption, category.id === categoryId && styles.categorySelected]}>{category.name}</Text>)}</View><View style={styles.row}><View style={styles.half}><Field label="Pack size" placeholder="1 kg" value={packSize} onChangeText={setPackSize}/></View><View style={styles.half}><Field label="Unit" placeholder="bag" value={unit} onChangeText={setUnit}/></View></View><Field label="Seller SKU" placeholder="Agri-One stock code" value={sku} onChangeText={setSku}/><View style={styles.row}><View style={styles.half}><Field label="Price (INR)" placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={setPrice}/></View><View style={styles.half}><Field label="Initial stock" placeholder="0" keyboardType="number-pad" value={stock} onChangeText={setStock}/></View></View><Field label="Minimum order quantity" placeholder="1" keyboardType="number-pad" value={minimum} onChangeText={setMinimum}/><Button title="Create product" loading={posting} onPress={() => void submitProduct()}/></Panel></>}
    {isSupplier && <><Panel style={styles.summary}><Text style={styles.summaryTitle}>Business verification</Text><Text style={styles.summaryText}>{organization?.verificationStatus?.replaceAll("_", " ") ?? "Status unavailable"}</Text><Text style={styles.summaryText}>Listings stay hidden until the business and product are approved.</Text></Panel>
      <Text style={styles.sectionTitle}>Submit a product</Text><Panel style={styles.form}><Field label="Product name" placeholder="e.g. Water soluble NPK" value={productName} onChangeText={setProductName}/><Field label="Description" placeholder="Product details" value={description} onChangeText={setDescription} multiline/><Text style={styles.label}>Category</Text><View style={styles.categoryOptions}>{categories.filter(item => item.slug).map((category: CatalogCategory) => <Text key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.categoryOption, category.id === categoryId && styles.categorySelected]}>{category.name}</Text>)}</View><View style={styles.row}><View style={styles.half}><Field label="Pack size" placeholder="1 kg" value={packSize} onChangeText={setPackSize}/></View><View style={styles.half}><Field label="Unit" placeholder="bag" value={unit} onChangeText={setUnit}/></View></View><Field label="Seller SKU" placeholder="Your stock code" value={sku} onChangeText={setSku}/><View style={styles.row}><View style={styles.half}><Field label="Price (INR)" placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={setPrice}/></View><View style={styles.half}><Field label="Initial stock" placeholder="0" keyboardType="number-pad" value={stock} onChangeText={setStock}/></View></View><Field label="Minimum order quantity" placeholder="1" keyboardType="number-pad" value={minimum} onChangeText={setMinimum}/><Button title="Submit for approval" loading={posting} onPress={() => void submitProduct()}/></Panel>
      <Text style={styles.sectionTitle}>Orders to fulfil</Text>{orders.length ? orders.map(order => <Panel key={order.id} style={styles.record}><View style={styles.recordTop}><Text style={styles.recordName}>{order.customerOrder.orderNumber}</Text><Text style={styles.status}>{order.status.replaceAll("_", " ")}</Text></View><Text style={styles.meta}>{new Date(order.createdAt).toLocaleDateString("en-IN")} · {money(order.total)} · {order.customerOrder.deliveryDistrict} {order.customerOrder.deliveryPinCode}</Text>{order.lines.map(line => <Text key={line.id} style={styles.meta}>{line.quantity} × {line.productNameSnapshot}</Text>)}{order.status === "NEW" && <View style={styles.actions}><Button title="Accept" onPress={() => void decideOrder(order.id, "ACCEPT")} style={styles.action}/><Button title="Reject" variant="outline" onPress={() => void decideOrder(order.id, "REJECT")} style={styles.action}/></View>}</Panel>) : <Text style={styles.muted}>No orders to fulfil right now.</Text>}
      <Text style={styles.sectionTitle}>Your approved listings</Text>{ownOffers.length ? ownOffers.map(({ product, offer }) => <SupplierStockCard key={offer.id} offerId={offer.id} name={`${product.name} · ${money(offer.price)}`} available={offer.availableStock} token={token} onUpdated={() => void loadCatalog()}/>) : <Text style={styles.muted}>Approved listings will appear here in the catalogue.</Text>}
    </>}
    {!isAdmin && !isSupplier && <><Panel style={styles.summary}><Text style={styles.summaryTitle}>Verification</Text><Text style={styles.summaryText}>{organization?.verificationStatus?.replaceAll("_", " ") ?? "Not available"}</Text><Text style={styles.summaryText}>Order checkout is enabled after your business is approved.</Text></Panel><Button title="Browse products" onPress={() => router.replace("/(tabs)")}/><View style={{ height: 10 }}/><Button title="View my orders" variant="outline" onPress={() => router.push("/(tabs)/orders")}/></>}
    <View style={{ height: 18 }}/><Button title="Refresh workspace" variant="plain" onPress={() => void load()}/>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 35 }, eyebrow: { marginTop: 8, color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { marginTop: 6, color: colors.dark, fontSize: 26, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 11 }, sectionTitle: { marginTop: 23, marginBottom: 10, color: colors.dark, fontSize: 16, fontWeight: "900" }, stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }, stat: { width: "48%", padding: 12 }, statValue: { color: colors.dark, fontSize: 20, fontWeight: "900" }, statLabel: { marginTop: 3, color: colors.muted, fontSize: 10 }, summary: { marginTop: 14, gap: 7, backgroundColor: colors.greenTint, borderColor: colors.greenTint }, summaryTitle: { color: colors.dark, fontSize: 14, fontWeight: "900" }, summaryText: { color: colors.text, fontSize: 11, lineHeight: 16 }, record: { marginBottom: 9, gap: 8 }, recordTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, recordName: { flex: 1, color: colors.dark, fontSize: 13, fontWeight: "800" }, status: { color: colors.green, fontSize: 9, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 10, lineHeight: 15 }, actions: { flexDirection: "row", gap: 8 }, action: { flex: 1, minHeight: 40 }, muted: { color: colors.muted, fontSize: 11 }, form: { gap: 13 }, label: { color: colors.dark, fontSize: 12, fontWeight: "700" }, categoryOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, categoryOption: { overflow: "hidden", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 17, backgroundColor: colors.white, color: colors.muted, fontSize: 10 }, categorySelected: { backgroundColor: colors.green, color: colors.white }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, errorPanel: { marginTop: 14, gap: 10 }, error: { color: colors.red, fontSize: 11 }, fulfillment: { paddingTop: 8, borderTopWidth: 1, borderColor: colors.line, gap: 8 } });
