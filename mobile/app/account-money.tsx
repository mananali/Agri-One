import { AgriText as Text } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { apiRequest, money, type Wallet } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

export default function MoneyScreen() {
  const { token } = useAppStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try { setWallet(await apiRequest<Wallet>("/auth/me/wallet", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Money</Text><View style={styles.spacer} /></View>
    {!token ? <View style={styles.center}><Text style={styles.title}>Sign in to view Money</Text><Pressable onPress={() => router.push("/login")} style={styles.button}><Text style={styles.buttonText}>Sign in</Text></Pressable></View> : loading && !wallet ? <ActivityIndicator style={{ marginTop: 36 }} color={colors.green} /> : error ? <View style={styles.center}><Text style={styles.title}>Could not load Money</Text><Text style={styles.hint}>{error}</Text><Pressable onPress={() => void load()} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}><Text style={styles.kicker}>AGRI-ONE WALLET</Text><Text style={styles.balance}>{money(wallet?.balance ?? 0)}</Text><Text style={styles.balanceHint}>Available money</Text><View style={styles.coins}><Text style={styles.coinIcon}>✦</Text><Text style={styles.coinValue}>{wallet?.coinBalance ?? 0} Coins</Text></View></View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>Payments are not connected yet</Text><Text style={styles.noticeCopy}>Your balance and coins come from the Agri-One account ledger. Adding money and checkout payments will appear when payment services are connected.</Text></View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Wallet activity</Text><Pressable onPress={() => router.push("/account-statement")}><Text style={styles.link}>ORDER STATEMENT ›</Text></Pressable></View>
      {!wallet?.transactions.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No wallet activity yet</Text><Text style={styles.hint}>Credits and debits will appear here when the wallet is active.</Text></View> : <View style={styles.list}>{wallet.transactions.map(item => <View key={item.id} style={styles.transaction}><View style={[styles.transactionIcon, item.type === "CREDIT" ? styles.credit : styles.debit]}><Text style={styles.transactionSign}>{item.type === "CREDIT" ? "+" : "−"}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionTitle}>{item.description}</Text><Text style={styles.hint}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></View><View style={styles.transactionValue}><Text style={styles.amount}>{money(item.amount)}</Text>{item.coinDelta !== 0 && <Text style={styles.hint}>{item.coinDelta > 0 ? "+" : ""}{item.coinDelta} coins</Text>}</View></View>)}</View>}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, header: { height: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line }, back: { width: 30, color: colors.dark, fontSize: 34 }, headerTitle: { color: colors.dark, fontSize: 16, fontWeight: "900" }, spacer: { width: 30 }, content: { padding: 17, paddingBottom: 30 }, balanceCard: { minHeight: 177, padding: 19, borderRadius: 18, backgroundColor: "#005B39" }, kicker: { color: "#D8CA68", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 }, balance: { marginTop: 18, color: colors.white, fontSize: 34, fontWeight: "900" }, balanceHint: { marginTop: 1, color: "#C4DDD0", fontSize: 10 }, coins: { position: "absolute", right: 17, top: 17, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: "#146F4B" }, coinIcon: { color: "#E4CE55", fontSize: 14 }, coinValue: { color: colors.white, fontSize: 10, fontWeight: "900" }, notice: { marginTop: 13, padding: 14, borderRadius: 13, backgroundColor: "#FFF8E7", borderWidth: 1, borderColor: "#EFE2B8" }, noticeTitle: { color: "#725E1D", fontSize: 11, fontWeight: "900" }, noticeCopy: { marginTop: 5, color: "#81764B", fontSize: 10, lineHeight: 16 }, sectionHead: { marginTop: 22, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: colors.dark, fontSize: 15, fontWeight: "900" }, link: { color: colors.green, fontSize: 9, fontWeight: "900" }, empty: { padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white }, emptyTitle: { color: colors.dark, fontSize: 12, fontWeight: "900" }, hint: { marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: 15 }, list: { paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white }, transaction: { minHeight: 66, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, transactionIcon: { width: 34, height: 34, borderRadius: 18, alignItems: "center", justifyContent: "center" }, credit: { backgroundColor: "#E8F6EF" }, debit: { backgroundColor: "#FFF0EE" }, transactionSign: { color: colors.green, fontSize: 19, fontWeight: "900" }, transactionCopy: { flex: 1, marginLeft: 10 }, transactionTitle: { color: colors.dark, fontSize: 10, fontWeight: "800" }, transactionValue: { alignItems: "flex-end" }, amount: { color: colors.dark, fontSize: 11, fontWeight: "900" }, center: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }, title: { color: colors.dark, fontSize: 17, fontWeight: "900" }, button: { marginTop: 15, paddingHorizontal: 23, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.green }, buttonText: { color: colors.white, fontSize: 11, fontWeight: "900" } });
