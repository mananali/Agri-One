import { AgriText as Text } from "../components/AgriText";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Panel } from "../components/Controls";
import { apiRequest, money, type Order } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

type InvoiceOrder = Order & {
  subtotal: number | string;
  taxTotal: number | string;
  deliveryName: string;
  deliveryAddress: string;
  deliveryArea: string;
  deliveryDistrict: string;
  deliveryPinCode: string;
  fulfillments: Array<{ lines: Array<{ id: string; productNameSnapshot: string; skuSnapshot: string; quantity: number; unitPriceSnapshot: number | string; taxAmount: number | string; lineTotal: number | string }> }>;
};
type Invoice = { invoiceNumber: string; issuedAt: string; seller: string; retailer: string; order: InvoiceOrder };

export default function OrderInvoiceScreen() {
  const { orderNumber = "" } = useLocalSearchParams<{ orderNumber: string }>();
  const { token } = useAppStore();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!token) { setError("Sign in to view this invoice."); setLoading(false); return; }
    apiRequest<Invoice>(`/orders/${encodeURIComponent(orderNumber)}/invoice`, token).then(value => { if (active) setInvoice(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load invoice."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderNumber, token]);

  async function shareInvoice() {
    if (!invoice) return;
    const lines = invoice.order.fulfillments.flatMap(group => group.lines).map(line => `${line.productNameSnapshot} × ${line.quantity}: ${money(line.lineTotal)}`).join("\n");
    const message = `${invoice.seller}\nInvoice ${invoice.invoiceNumber}\nOrder ${invoice.order.orderNumber}\n${lines}\nSubtotal: ${money(invoice.order.subtotal)}\nTax: ${money(invoice.order.taxTotal)}\nTotal: ${money(invoice.order.total)}`;
    if (Platform.OS === "web") window.print(); else await Share.share({ title: `Invoice ${invoice.invoiceNumber}`, message });
  }

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.green} style={{ marginTop: 45 }}/></SafeAreaView>;
  if (!invoice) return <SafeAreaView style={styles.safe} edges={["top"]}><EmptyState title="Invoice unavailable" detail={error} action={<Button title="Back to orders" onPress={() => router.back()}/>}/></SafeAreaView>;
  const lines = invoice.order.fulfillments.flatMap(group => group.lines);
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  My Orders</Text></Pressable>
      <Panel style={styles.invoice}>
        <Text style={styles.seller}>{invoice.seller}</Text><Text style={styles.title}>Order Invoice</Text>
        <View style={styles.meta}><View><Text style={styles.label}>INVOICE NUMBER</Text><Text style={styles.value}>{invoice.invoiceNumber}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={styles.label}>DATE</Text><Text style={styles.value}>{new Date(invoice.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></View></View>
        <View style={styles.rule}/>
        <Text style={styles.label}>BILLED TO</Text><Text style={styles.value}>{invoice.retailer}</Text><Text style={styles.address}>{invoice.order.deliveryName} · {invoice.order.deliveryAddress}, {invoice.order.deliveryArea}, {invoice.order.deliveryDistrict} {invoice.order.deliveryPinCode}</Text>
        <View style={[styles.rule, { marginTop: 18 }]}/>
        <View style={styles.tableHead}><Text style={[styles.label, { flex: 1 }]}>ITEM</Text><Text style={styles.label}>QTY</Text><Text style={[styles.label, styles.right]}>AMOUNT</Text></View>
        {lines.map(line => <View key={line.id} style={styles.item}><View style={{ flex: 1 }}><Text style={styles.value}>{line.productNameSnapshot}</Text><Text style={styles.itemSub}>{line.skuSnapshot} · {money(line.unitPriceSnapshot)} each</Text></View><Text style={styles.value}>{line.quantity}</Text><Text style={[styles.value, styles.right]}>{money(line.lineTotal)}</Text></View>)}
        <View style={[styles.rule, { marginTop: 10 }]}/>
        <View style={styles.totalLine}><Text style={styles.label}>Subtotal</Text><Text style={styles.value}>{money(invoice.order.subtotal)}</Text></View>
        <View style={styles.totalLine}><Text style={styles.label}>Tax</Text><Text style={styles.value}>{money(invoice.order.taxTotal)}</Text></View>
        <View style={[styles.totalLine, styles.grandTotal]}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandValue}>{money(invoice.order.total)}</Text></View>
        <Text style={styles.note}>This invoice reflects the order details saved by Agri-One.</Text>
      </Panel>
      <Pressable style={styles.shareButton} onPress={() => void shareInvoice()}><Text style={styles.shareText}>{Platform.OS === "web" ? "PRINT INVOICE" : "SHARE INVOICE"}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F7F7F7" }, content: { padding: 16, paddingBottom: 28 }, back: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 4 }, backText: { color: colors.green, fontSize: 15, fontWeight: "700" }, invoice: { marginTop: 8, padding: 19, backgroundColor: "#FFFFFF", borderRadius: 16 }, seller: { color: colors.green, fontSize: 13, fontWeight: "900" }, title: { marginTop: 5, color: "#171717", fontSize: 24, fontWeight: "900" }, meta: { marginTop: 20, flexDirection: "row", justifyContent: "space-between" }, label: { color: "#898989", fontSize: 10, fontWeight: "800", letterSpacing: .6 }, value: { marginTop: 5, color: "#282828", fontSize: 12, fontWeight: "700" }, rule: { height: 1, marginVertical: 16, backgroundColor: "#EAEAEA" }, address: { marginTop: 5, color: "#666666", fontSize: 12, lineHeight: 18 }, tableHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 9 }, item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: 1, borderColor: "#F0F0F0" }, itemSub: { marginTop: 4, color: "#888888", fontSize: 10 }, right: { width: 75, textAlign: "right" }, totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }, grandTotal: { marginTop: 7, borderTopWidth: 1, borderColor: "#E9E9E9", paddingTop: 12 }, grandLabel: { color: "#171717", fontSize: 15, fontWeight: "900" }, grandValue: { color: colors.green, fontSize: 19, fontWeight: "900" }, note: { marginTop: 18, color: "#999999", fontSize: 10, textAlign: "center" }, shareButton: { height: 48, marginTop: 14, borderRadius: 13, backgroundColor: "#078C12", alignItems: "center", justifyContent: "center" }, shareText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" } });
