import { AgriText as Text } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Button, Panel } from "../components/Controls";
import { apiRequest, type Wallet } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

export default function SchemesScreen() {
  const { promotions, token } = useAppStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try { setWallet(await apiRequest<Wallet>("/auth/me/wallet", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Rewards balance could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const kind = (type: string) => type === "BULK" ? "BULK DEAL" : type === "REWARDS" ? "REWARD POINTS" : "FESTIVAL OFFER";
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable><Text style={styles.title}>Dealer Schemes</Text><Text style={styles.subtitle}>Current offers and retailer reward points.</Text>
    <Panel style={styles.points}><Text style={styles.pointsLabel}>YOUR REWARD POINTS</Text>{loading && !wallet ? <ActivityIndicator color={colors.white} style={{ alignSelf: "flex-start", marginTop: 11 }}/> : <Text style={styles.pointsValue}>{wallet?.coinBalance ?? 0} <Text style={styles.pointsUnit}>points</Text></Text>}<Pressable onPress={() => router.push("/account-statement")}><Text style={styles.pointsLink}>View account statement ›</Text></Pressable></Panel>
    <View style={styles.sectionHead}><Text style={styles.section}>Active offers</Text><Pressable onPress={() => router.replace("/(tabs)/explore")}><Text style={styles.browse}>Browse products ›</Text></Pressable></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {promotions.length ? promotions.map(promotion => <Panel key={promotion.id} style={styles.offer}><View style={styles.badge}><Text style={styles.badgeText}>{kind(promotion.type)}</Text></View><Text style={styles.offerTitle}>{promotion.title}</Text><Text style={styles.offerBody}>{promotion.body}</Text>{promotion.type === "BULK" && <Text style={styles.offerDate}>Minimum {promotion.minimumOrderQuantity ?? 1} items · {promotion.discountPercent ?? 0}% discount at checkout</Text>}{promotion.type === "FESTIVAL" && promotion.discountPercent && <Text style={styles.offerDate}>{promotion.discountPercent}% discount at checkout</Text>}{promotion.type === "REWARDS" && <Text style={styles.offerDate}>{promotion.coinsPer100} points per ₹100 order value</Text>}<Text style={styles.offerDate}>Valid until {new Date(promotion.endsAt).toLocaleDateString("en-IN")}</Text></Panel>) : <Panel style={styles.empty}><Text style={styles.emptyTitle}>No active dealer schemes</Text><Text style={styles.subtitle}>New festival offers and bulk deals will appear here when published.</Text></Panel>}
    <Text style={styles.note}>Checkout-এ দেখা discount-ই চূড়ান্ত। এক অর্ডারে প্রযোজ্য সর্বোচ্চ একটি discount-ই লাগবে।</Text>
    <Button title="Contact support about an offer" variant="outline" onPress={() => router.push("/support")} style={{ marginTop: 16 }}/>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 30 }, back: { color: colors.green, fontSize: 12, fontWeight: "800" }, title: { marginTop: 12, color: colors.dark, fontSize: 25, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 11, lineHeight: 16 }, points: { marginTop: 18, minHeight: 133, backgroundColor: colors.greenDark, borderColor: colors.greenDark }, pointsLabel: { color: "#D5E7D8", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, pointsValue: { marginTop: 9, color: colors.white, fontSize: 29, fontWeight: "900" }, pointsUnit: { color: "#DAE9DC", fontSize: 12, fontWeight: "700" }, pointsLink: { marginTop: 10, color: "#D5E7D8", fontSize: 9, fontWeight: "800" }, sectionHead: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, section: { marginVertical: 12, color: colors.dark, fontSize: 16, fontWeight: "900" }, browse: { color: colors.green, fontSize: 9, fontWeight: "900" }, offer: { marginBottom: 10, gap: 8 }, badge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.greenTint }, badgeText: { color: colors.green, fontSize: 8, fontWeight: "900" }, offerTitle: { color: colors.dark, fontSize: 14, fontWeight: "900" }, offerBody: { color: colors.muted, fontSize: 11, lineHeight: 17 }, offerDate: { color: colors.green, fontSize: 9, fontWeight: "800" }, empty: { gap: 8 }, emptyTitle: { color: colors.dark, fontSize: 13, fontWeight: "900" }, note: { marginTop: 12, color: colors.muted, fontSize: 9, lineHeight: 15 }, error: { marginTop: 9, color: colors.red, fontSize: 10 },
});
