import { AgriText as Text } from "../../components/AgriText";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { apiRequest, money, type CertificateApplication, type ComplianceDocument, type DeliveryAddress, type Order, type Wallet } from "../../src/api";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

type RowProps = { icon: string; title: string; value?: string; valueTone?: "green" | "muted"; onPress?: () => void; last?: boolean };
function MenuRow({ icon, title, value, valueTone = "muted", onPress, last = false }: RowProps) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}>
    <Text style={styles.rowIcon}>{icon}</Text><Text style={styles.rowTitle}>{title}</Text>{!!value && <Text style={[styles.rowValue, valueTone === "green" && styles.rowValueGreen]} numberOfLines={1}>{value}</Text>}<Text style={styles.chevron}>›</Text>
  </Pressable>;
}
function MenuSection({ title, rows }: { title: string; rows: RowProps[] }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.menuCard}>{rows.map((row, index) => <MenuRow key={row.title} {...row} last={index === rows.length - 1} />)}</View></View>;
}

export default function AccountScreen() {
  const { token, user, organization, signOut, loadingSession } = useAppStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [applications, setApplications] = useState<CertificateApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadAccount = useCallback(async () => {
    if (!token) { setOrders([]); setDocuments([]); setWallet(null); setAddresses([]); setApplications([]); setLoadError(""); return; }
    setLoading(true); setLoadError("");
    try {
      const [orderResult, documentResult, walletResult, addressResult, applicationResult] = await Promise.allSettled([
        apiRequest<Order[]>("/orders", token),
        apiRequest<ComplianceDocument[]>("/auth/me/documents", token),
        apiRequest<Wallet>("/auth/me/wallet", token),
        user?.role === "RETAILER" ? apiRequest<DeliveryAddress[]>("/orders/addresses", token) : Promise.resolve([] as DeliveryAddress[]),
        apiRequest<CertificateApplication[]>("/auth/me/certificate-applications", token),
      ]);
      if (orderResult.status === "fulfilled") {
        const result = orderResult.value as unknown as Array<Order & { fulfillmentNumber?: string; customerOrder?: { orderNumber: string } }>;
        setOrders(result.map(order => ({ ...order, orderNumber: order.customerOrder?.orderNumber ?? order.fulfillmentNumber ?? order.orderNumber })));
      }
      if (documentResult.status === "fulfilled") setDocuments(documentResult.value); else setLoadError("Compliance status could not be refreshed.");
      if (walletResult.status === "fulfilled") setWallet(walletResult.value);
      if (addressResult.status === "fulfilled") setAddresses(addressResult.value);
      if (applicationResult.status === "fulfilled") setApplications(applicationResult.value);
    } finally { setLoading(false); }
  }, [token, user?.role]);

  useFocusEffect(useCallback(() => { void loadAccount(); }, [loadAccount]));
  const activeOrders = useMemo(() => orders.filter(order => !["DELIVERED", "CANCELLED", "REJECTED"].includes(order.status)), [orders]);
  const initials = user?.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "AG";
  const documentStatus = (matches: RegExp) => {
    const matchingDocuments = documents.filter(item => matches.test(item.documentType.toLowerCase()));
    if (!matchingDocuments.length) return loadError ? "Retry" : "Not submitted";
    if (matchingDocuments.some(item => item.reviewStatus === "APPROVED")) return "Verified";
    if (matchingDocuments.some(item => item.reviewStatus === "NEEDS_CORRECTION" || item.reviewStatus === "REJECTED")) return "Needs correction";
    const document = matchingDocuments[0];
    return document.reviewStatus.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };
  const latestApplication = applications[0];
  const applicationLabel = latestApplication?.status === "PENDING" ? "Pending" : latestApplication?.status === "APPROVED" ? "Approved" : latestApplication?.status === "NEEDS_CORRECTION" ? "Update needed" : "Apply";

  const rows: RowProps[][] = [
    [
      { icon: "▭", title: "Money", value: wallet ? `${money(wallet.balance)} · ${wallet.coinBalance} Coins` : loading ? "Loading…" : "Open", valueTone: "green", onPress: () => router.push("/account-money") },
      { icon: "⬡", title: "My Orders", value: loading ? "Loading…" : `${activeOrders.length} Active`, onPress: () => router.push("/(tabs)/orders") },
      { icon: "⌖", title: "Delivery Addresses", value: loading ? "Loading…" : `${addresses.length} saved`, onPress: () => router.push("/account-addresses") },
      { icon: "▤", title: "Ledger & Statement", value: "View", onPress: () => router.push("/account-statement") },
      { icon: "□", title: "My Shop Stock", value: "Manage", valueTone: "green", onPress: () => router.push("/(tabs)/stock") },
      { icon: "%", title: "Dealer Schemes & Rewards", value: wallet ? `${wallet.coinBalance} points` : "View offers", valueTone: "green", onPress: () => router.push("/schemes") },
    ],
    [
      { icon: "⌂", title: "Shop Details", value: "Edit", valueTone: "green", onPress: () => router.push(token ? "/shop-details" : "/login") },
      { icon: "▤", title: "Supporting ID", value: documentStatus(/supporting|aadhaar|aadhar|gst|pan|voter/), valueTone: "green", onPress: () => router.push(token ? "/account-documents" : "/login") },
      { icon: "▤", title: "GSTIN, PAN & Bank Details", value: "Business profile", valueTone: "green", onPress: () => router.push(token ? "/retailer-profile" : "/login") },
      { icon: "⬡", title: "License", value: documentStatus(/licen/), onPress: () => router.push(token ? { pathname: "/account-documents", params: { tab: "license" } } : "/login") },
      { icon: "▤", title: "Apply for Principal Certificate", value: applicationLabel, valueTone: "green", onPress: () => router.push(token ? "/account-certificate" : "/login") },
    ],
    [
      { icon: "ⓘ", title: "Help & Support", value: "Contact", valueTone: "green", onPress: () => router.push("/support") },
      { icon: "⚙", title: "App Settings", onPress: () => router.push("/account-settings") },
    ],
  ];

  const signOutConfirm = () => Alert.alert("Sign out of Agri-One?", "You can sign in again any time.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } },
  ]);

  if (loadingSession) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.green} /></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAccount} tintColor={colors.green} />}>
      <View style={styles.topBar}><Text style={styles.pageTitle}>Profile</Text><View style={styles.topActions}><Pressable accessibilityRole="button" accessibilityLabel="View orders" onPress={() => router.push("/(tabs)/orders")} style={styles.topButton}><Text style={styles.topIcon}>♧</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="App settings" onPress={() => router.push("/account-settings")} style={styles.topButton}><Text style={styles.topIcon}>⚙</Text></Pressable></View></View>
      <View style={styles.profileCard}>
        <View style={styles.profileIdentityRow}>
          <View style={styles.avatarOuter}><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View><View style={styles.avatarRing} /></View>
          <View style={styles.profileInfo}>
            <Text numberOfLines={1} style={styles.profileName}>{user?.name ?? "Retailer name"}</Text>
            <Text numberOfLines={1} style={styles.businessName}>{organization?.name ?? "Shop name not added"}</Text>
            <Text numberOfLines={1} style={styles.profileMeta}>{user?.phone ?? "Mobile number not added"}</Text>
            {!!user && <View style={[styles.verificationBadge, organization?.verificationStatus === "APPROVED" ? styles.verifiedBadge : styles.pendingBadge]}><Text style={[styles.verificationText, organization?.verificationStatus === "APPROVED" ? styles.verifiedText : styles.pendingText]}>{organization?.verificationStatus === "APPROVED" ? "✓  Verified" : `•  ${organization?.verificationStatus?.replaceAll("_", " ") ?? "Not submitted"}`}</Text></View>}
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push(token ? "/shop-details" : "/login")} style={({ pressed }) => [styles.editProfileButton, pressed && styles.pressed]}>
          <Text style={styles.editGlyph}>✎</Text><Text style={styles.editProfileText}>Edit profile</Text><Text style={styles.editArrow}>›</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => router.push("/(tabs)/business")} style={({ pressed }) => [styles.businessBanner, pressed && styles.pressed]}><View style={styles.bannerIcon}><Text style={styles.bannerIconText}>A</Text></View><View style={styles.bannerCopy}><Text style={styles.bannerTitle}>{token ? "Your Agri-One business" : "Join Agri-One"}</Text><Text style={styles.bannerSubtitle}>{token ? "Manage your store and orders" : "Create a retailer or supplier account"}</Text></View><Text style={styles.bannerArrow}>›</Text></Pressable>
      <MenuSection title="Shop & Orders" rows={rows[0]} />
      <MenuSection title="Compliance & Documents" rows={rows[1]} />
      <MenuSection title="App & Support" rows={rows[2]} />
      {token && <Pressable onPress={signOutConfirm} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>}
      <Text style={styles.footer}>Agri-One · Smart Farming Solutions</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F7" },
  content: { paddingHorizontal: 16, paddingBottom: 22 },
  topBar: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { color: "#171B19", fontSize: 25, fontWeight: "900", letterSpacing: -.5 },
  topActions: { flexDirection: "row", gap: 10 },
  topButton: { width: 42, height: 42, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E7EAE8", backgroundColor: colors.white },
  topIcon: { color: "#252B27", fontSize: 20 },
  profileCard: { marginTop: 12, padding: 15, borderWidth: 1, borderColor: "#E8EAE8", borderRadius: 17, backgroundColor: colors.white },
  profileIdentityRow: { flexDirection: "row", alignItems: "center" },
  pressed: { opacity: .82 },
  avatarOuter: { width: 66, height: 66, alignItems: "center", justifyContent: "center" },
  avatar: { width: 58, height: 58, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenDark },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: "900" },
  avatarRing: { position: "absolute", width: 65, height: 65, borderWidth: 2, borderColor: "#D4B447", borderRadius: 34 },
  profileInfo: { flex: 1, paddingLeft: 12, minWidth: 0 },
  profileName: { color: "#1C201D", fontSize: 16, fontWeight: "900" },
  businessName: { marginTop: 4, color: "#2E342F", fontSize: 12, fontWeight: "700" },
  profileMeta: { marginTop: 4, color: "#68746C", fontSize: 11 },
  editProfileButton: { minHeight: 42, marginTop: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#E8F4E9" },
  editGlyph: { color: colors.green, fontSize: 17, fontWeight: "900" },
  editProfileText: { marginLeft: 7, color: colors.green, fontSize: 12, fontWeight: "900" },
  editArrow: { marginLeft: 5, color: colors.green, fontSize: 20, lineHeight: 22 },
  verificationBadge: { alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 15, borderWidth: 1 },
  verifiedBadge: { borderColor: "#B8E2CE", backgroundColor: "#ECF9F2" },
  pendingBadge: { borderColor: "#EAD9A7", backgroundColor: "#FFF9E9" },
  verificationText: { fontSize: 8, fontWeight: "900", textTransform: "capitalize" },
  verifiedText: { color: "#148157" },
  pendingText: { color: "#92742A" },
  businessBanner: { minHeight: 86, marginTop: 15, paddingHorizontal: 15, paddingVertical: 13, flexDirection: "row", alignItems: "center", borderRadius: 15, backgroundColor: "#00633E" },
  bannerIcon: { width: 47, height: 47, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#137751" },
  bannerIconText: { color: "#E6D46A", fontSize: 23, fontWeight: "900" },
  bannerCopy: { flex: 1, marginLeft: 12 },
  bannerTitle: { color: colors.white, fontSize: 14, fontWeight: "900" },
  bannerSubtitle: { marginTop: 4, color: "#C8E2D4", fontSize: 10 },
  bannerArrow: { color: colors.white, fontSize: 28 },
  section: { marginTop: 22 },
  sectionTitle: { marginBottom: 10, color: "#1E221F", fontSize: 17, fontWeight: "900", letterSpacing: -.2 },
  menuCard: { overflow: "hidden", borderWidth: 1, borderColor: "#E6E8E6", borderRadius: 16, backgroundColor: colors.white },
  row: { minHeight: 57, paddingHorizontal: 15, flexDirection: "row", alignItems: "center" },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E3E6E4" },
  rowIcon: { width: 28, color: "#1D2620", fontSize: 19, textAlign: "left" },
  rowTitle: { flex: 1, marginLeft: 8, color: "#202521", fontSize: 13, fontWeight: "600" },
  rowValue: { maxWidth: "36%", color: "#79827C", fontSize: 10, fontWeight: "700", textAlign: "right", textTransform: "capitalize" },
  rowValueGreen: { color: colors.green },
  chevron: { marginLeft: 9, color: "#9AA19C", fontSize: 23, lineHeight: 26 },
  signOut: { minHeight: 48, marginTop: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F0D7D2", borderRadius: 12, backgroundColor: "#FFF9F8" },
  signOutText: { color: "#B4493A", fontSize: 12, fontWeight: "800" },
  footer: { paddingVertical: 18, color: "#9AA29D", fontSize: 9, fontWeight: "700", textAlign: "center" },
});
