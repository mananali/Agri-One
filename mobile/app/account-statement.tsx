import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { apiRequest, money } from "../src/api";
import { useAppStore } from "../src/store";

type Period = "thisMonth" | "lastMonth" | "90Days" | "custom";
type Entry = { id: string; orderNumber: string; status: string; total: number | string; createdAt: string };
type Statement = { totalSpent: number; orderCount: number; refunds: number; coins: number; profitEarned: number; orders: Entry[] };

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (date: Date) => date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const displayDate = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);

function periodRange(period: Period, now = new Date()) {
  if (period === "lastMonth") return { from: dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: dateKey(new Date(now.getFullYear(), now.getMonth(), 0)) };
  if (period === "90Days") return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)), to: dateKey(now) };
  return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateKey(now) };
}

export default function StatementScreen() {
  const { token } = useAppStore();
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [customFrom, setCustomFrom] = useState(dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(dateKey(new Date()));
  const [draftFrom, setDraftFrom] = useState(customFrom);
  const [draftTo, setDraftTo] = useState(customTo);
  const [customOpen, setCustomOpen] = useState(false);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(() => period === "custom" ? { from: customFrom, to: customTo } : periodRange(period), [period, customFrom, customTo]);
  const summaryPeriod = period === "thisMonth" ? new Date().toLocaleDateString("en-IN", { month: "long" }).toUpperCase() : period === "lastMonth" ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString("en-IN", { month: "long" }).toUpperCase() : period === "90Days" ? "90 DAYS" : "CUSTOM PERIOD";
  const headingDate = useMemo(() => {
    if (period === "thisMonth") return dateLabel(new Date());
    if (period === "lastMonth") return dateLabel(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    if (period === "90Days") return "Last 90 Days";
    return `${displayDate(`${customFrom}T00:00:00`)} – ${displayDate(`${customTo}T00:00:00`)}`;
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ fromDate: range.from, toDate: range.to });
      setStatement(await apiRequest<Statement>(`/orders/statement?${query.toString()}`, token));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Statement could not be loaded."); }
    finally { setLoading(false); }
  }, [token, range.from, range.to]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const exportPdf = useCallback(async (action: "email" | "download") => {
    if (!statement) return;
    setSharing(true);
    try {
      const rows = statement.orders.map(order => `<tr><td>${escapeHtml(order.orderNumber)}</td><td>${escapeHtml(displayDate(order.createdAt))}</td><td>${escapeHtml(order.status.replaceAll("_", " "))}</td><td class="amount">${escapeHtml(money(order.total))}</td></tr>`).join("");
      const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#19251e;padding:28px}h1{font-size:23px;margin:0}p{color:#66736b}.summary{background:#00613d;color:white;padding:22px;border-radius:14px;margin:20px 0}.label{font-size:11px;letter-spacing:1px}.total{font-size:32px;font-weight:700;margin:12px 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:11px 6px;border-bottom:1px solid #e4e9e5;font-size:12px}.amount{text-align:right}th{color:#66736b}</style></head><body><h1>Account Statement</h1><p>${escapeHtml(headingDate)}</p><div class="summary"><div class="label">TOTAL SPENT</div><div class="total">${escapeHtml(money(statement.totalSpent))}</div><div>${statement.orderCount} orders · Profit earned: ${escapeHtml(money(statement.profitEarned))}</div></div><h2>Transactions</h2>${rows ? `<table><thead><tr><th>Order</th><th>Date</th><th>Status</th><th class="amount">Amount</th></tr></thead><tbody>${rows}</tbody></table>` : "<p>No transactions found for this period.</p>"}</body></html>`;
      const file = await Print.printToFileAsync({ html });
      if (action === "email" && await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Email account statement PDF" });
      else await Print.printAsync({ uri: file.uri });
    } catch (cause) { Alert.alert("Could not create PDF", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setSharing(false); }
  }, [statement, headingDate]);

  const applyCustom = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(draftTo) || draftFrom > draftTo) {
      Alert.alert("Choose a valid date range", "Enter dates as YYYY-MM-DD. The start date must be before the end date."); return;
    }
    setCustomFrom(draftFrom); setCustomTo(draftTo); setPeriod("custom"); setCustomOpen(false);
  };

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable>
      <View style={styles.titleGroup}><Text style={styles.headerTitle}>Account Statement</Text><Text style={styles.dateTitle}>{headingDate}</Text></View>
      <View style={styles.newBadge}><Text style={styles.newText}>NEW</Text></View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {([{ key: "thisMonth", label: "This Month" }, { key: "lastMonth", label: "Last Month" }, { key: "90Days", label: "90 Days" }, { key: "custom", label: "Custom" }] as const).map(item => <Pressable key={item.key} onPress={() => item.key === "custom" ? (setDraftFrom(customFrom), setDraftTo(customTo), setCustomOpen(true)) : setPeriod(item.key)} style={[styles.filter, period === item.key && styles.filterActive]}><Text style={[styles.filterText, period === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}
    </ScrollView>
    {!token ? <View style={styles.center}><Text style={styles.noTitle}>Sign in to view your statement</Text><Pressable onPress={() => router.push("/login")} style={styles.signIn}><Text style={styles.signInText}>Sign in</Text></Pressable></View> : loading && !statement ? <ActivityIndicator style={{ marginTop: 36 }} color="#00834F" /> : error ? <View style={styles.center}><Text style={styles.noTitle}>Statement unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void load()} style={styles.signIn}><Text style={styles.signInText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content}>
      <LinearGradient colors={["#008452", "#004B30"]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={styles.summary}>
        <Text style={styles.summaryLabel}>TOTAL SPENT ({summaryPeriod})</Text>
        <Text style={styles.total}>{money(statement?.totalSpent ?? 0)}</Text>
        <Text style={styles.summaryHint}>{statement?.orderCount ?? 0} orders · Profit earned: {money(statement?.profitEarned ?? 0)}</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{statement?.orderCount ?? 0}</Text><Text style={styles.metricLabel}>Orders</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricValue}>{money(statement?.refunds ?? 0)}</Text><Text style={styles.metricLabel}>Refunds</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.coinValue}>+{statement?.coins ?? 0}</Text><Text style={styles.metricLabel}>Coins</Text></View>
        </View>
      </LinearGradient>
      <View style={styles.transactionCard}><Text style={styles.transactionHeading}>Transactions</Text>{statement?.orders.length ? statement.orders.map(order => <Pressable key={order.id} onPress={() => router.push({ pathname: "/order/[orderNumber]", params: { orderNumber: order.orderNumber } })} style={styles.transaction}><View style={styles.transactionCopy}><Text style={styles.orderNumber}>{order.orderNumber}</Text><Text style={styles.transactionDate}>{displayDate(order.createdAt)} · {order.status.replaceAll("_", " ")}</Text></View><Text style={styles.amount}>{money(order.total)}</Text></Pressable>) : <View style={styles.empty}><Text style={styles.emptyText}>{loading ? "Updating statement…" : "No transactions found"}</Text></View>}</View>
    </ScrollView>}
    <View style={styles.footer}>
      <Pressable disabled={!statement || sharing} onPress={() => void exportPdf("email")} style={({ pressed }) => [styles.action, pressed && styles.pressed, (!statement || sharing) && styles.disabled]}><Text style={styles.actionIcon}>✉</Text><Text style={styles.actionText}>{sharing ? "Preparing…" : "Email PDF"}</Text></Pressable>
      <Pressable disabled={!statement || sharing} onPress={() => void exportPdf("download")} style={({ pressed }) => [styles.action, styles.download, pressed && styles.pressed, (!statement || sharing) && styles.disabled]}><Text style={styles.actionIcon}>📥</Text><Text style={[styles.actionText, styles.downloadText]}>{sharing ? "Preparing…" : "Download"}</Text></Pressable>
    </View>
    <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}><View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>Custom date range</Text><Text style={styles.fieldLabel}>From (YYYY-MM-DD)</Text><TextInput value={draftFrom} onChangeText={setDraftFrom} autoCapitalize="none" style={styles.dateInput} placeholder="2026-11-01"/><Text style={styles.fieldLabel}>To (YYYY-MM-DD)</Text><TextInput value={draftTo} onChangeText={setDraftTo} autoCapitalize="none" style={styles.dateInput} placeholder="2026-11-24"/><View style={styles.modalActions}><Pressable onPress={() => setCustomOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={applyCustom} style={styles.apply}><Text style={styles.applyText}>Apply</Text></Pressable></View></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F7F7" }, header: { minHeight: 64, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E9E9E9", backgroundColor: "#FFFFFF" }, backButton: { width: 32, height: 32, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E7E7E7" }, back: { color: "#111111", fontSize: 22, lineHeight: 25 }, titleGroup: { flex: 1 }, headerTitle: { color: "#101010", fontSize: 17, fontWeight: "900", letterSpacing: -0.3 }, dateTitle: { marginTop: 4, color: "#666666", fontSize: 13 }, newBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 12, backgroundColor: "#F01843" }, newText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" }, filters: { minWidth: "100%", paddingHorizontal: 14, paddingVertical: 11, gap: 7, alignItems: "center", backgroundColor: "#FFFFFF" }, filter: { minWidth: 70, height: 33, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 20, backgroundColor: "#FFFFFF" }, filterActive: { borderColor: "#00834F", backgroundColor: "#00834F" }, filterText: { color: "#626262", fontSize: 12, fontWeight: "500" }, filterTextActive: { color: "#FFFFFF" }, content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 13 }, summary: { minHeight: 162, padding: 18, borderRadius: 10, backgroundColor: "#005B3A" }, summaryLabel: { color: "#B8D9C9", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 }, total: { marginTop: 12, color: "#FFFFFF", fontSize: 27, fontWeight: "900" }, summaryHint: { marginTop: 5, color: "#C6DDCF", fontSize: 10 }, metrics: { marginTop: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, metric: { flex: 1, alignItems: "center" }, metricValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, coinValue: { color: "#FFE46B", fontSize: 15, fontWeight: "900" }, metricLabel: { marginTop: 4, color: "#C3D9CD", fontSize: 9, fontWeight: "700" }, metricDivider: { width: 1, height: 29, backgroundColor: "#277357" }, transactionCard: { marginTop: 14, overflow: "hidden", borderWidth: 1, borderColor: "#E5E5E5", borderRadius: 9, backgroundColor: "#FFFFFF" }, transactionHeading: { paddingHorizontal: 14, paddingVertical: 12, color: "#161616", fontSize: 12, fontWeight: "800", borderBottomWidth: 1, borderBottomColor: "#E9E9E9" }, empty: { minHeight: 52, alignItems: "center", justifyContent: "center" }, emptyText: { color: "#686868", fontSize: 11 }, transaction: { minHeight: 38, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ECECEC" }, transactionCopy: { flex: 1 }, orderNumber: { color: "#202020", fontSize: 10, fontWeight: "800" }, transactionDate: { marginTop: 3, color: "#777777", fontSize: 9, textTransform: "capitalize" }, amount: { color: "#202020", fontSize: 10, fontWeight: "800" }, footer: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", gap: 9, borderTopWidth: 1, borderTopColor: "#E8E8E8", backgroundColor: "#FFFFFF" }, action: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#E6E6E6", borderRadius: 22, backgroundColor: "#FFFFFF" }, download: { borderColor: "#00834F", backgroundColor: "#00834F" }, actionIcon: { fontSize: 12 }, actionText: { color: "#1C1C1C", fontSize: 12, fontWeight: "600" }, downloadText: { color: "#FFFFFF" }, pressed: { opacity: 0.82 }, disabled: { opacity: 0.55 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 12 }, noTitle: { color: "#202020", fontSize: 13, fontWeight: "800", textAlign: "center" }, muted: { marginTop: 5, color: "#777777", fontSize: 10, textAlign: "center" }, signIn: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: "#00834F" }, signInText: { color: "#FFFFFF", fontWeight: "800", fontSize: 10 }, modalShade: { flex: 1, padding: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.38)" }, modal: { width: "100%", padding: 15, borderRadius: 10, backgroundColor: "#FFFFFF" }, modalTitle: { marginBottom: 12, color: "#171717", fontSize: 15, fontWeight: "900" }, fieldLabel: { marginTop: 6, marginBottom: 4, color: "#555555", fontSize: 9, fontWeight: "700" }, dateInput: { height: 34, paddingHorizontal: 8, borderWidth: 1, borderColor: "#E2E2E2", borderRadius: 6, color: "#222222", fontSize: 11 }, modalActions: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end", gap: 7 }, cancel: { paddingHorizontal: 10, paddingVertical: 7 }, cancelText: { color: "#555555", fontWeight: "700", fontSize: 10 }, apply: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 6, backgroundColor: "#00834F" }, applyText: { color: "#FFFFFF", fontWeight: "800", fontSize: 10 },
});
