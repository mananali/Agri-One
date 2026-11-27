import { AgriText as Text } from "../../components/AgriText";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Panel } from "../../components/Controls";
import { apiRequest, money, type Offer, type Product } from "../../src/api";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

type OrderLine = { id: string; offerId: string; productNameSnapshot: string; skuSnapshot: string; sourceSnapshot: string; unitPriceSnapshot: number | string; quantity: number; taxAmount: number | string; lineTotal: number | string };
type Fulfillment = { id: string; fulfillmentNumber: string; source: string; status: string; total: number | string; lines: OrderLine[]; shipment?: { status: string; trackingNumber?: string | null; events?: { status: string; note: string | null; occurredAt: string }[] } | null; seller?: { name: string } };
type OrderDetail = { id: string; orderNumber: string; status: string; paymentMethod?: string | null; payments?: { status: string }[]; createdAt: string; subtotal: number | string; discountTotal: number | string; taxTotal: number | string; total: number | string; deliveryName: string; deliveryAddress: string; deliveryArea: string; deliveryDistrict: string; deliveryPinCode: string; fulfillments: Fulfillment[] };
const deliveryStages = ["Order Confirmed", "Packed", "Shipped", "Delivered"];
function deliveryStage(group: Fulfillment) {
  const shipment = group.shipment?.status ?? "";
  if (shipment === "DELIVERED" || group.status === "DELIVERED") return 3;
  if (["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "RETURNING", "RETURNED"].includes(shipment) || group.status === "DISPATCHED") return 2;
  if (["READY_FOR_PICKUP", "PICKING"].includes(shipment) || ["ACCEPTED", "PICKING"].includes(group.status)) return 1;
  return 0;
}
function DeliveryTimeline({ group }: { group: Fulfillment }) {
  const active = deliveryStage(group);
  return <View style={styles.timeline}>{deliveryStages.map((stage, index) => <View key={stage} style={styles.stage}><View style={[styles.stageDot, index <= active && styles.stageDotActive]}><Text style={[styles.stageCheck, index <= active && styles.stageCheckActive]}>{index < active ? "✓" : index + 1}</Text></View>{index < deliveryStages.length - 1 && <View style={[styles.stageLine, index < active && styles.stageLineActive]}/>}<Text style={[styles.stageLabel, index === active && styles.stageLabelActive]}>{stage}</Text></View>)}</View>;
}

export default function OrderDetailScreen() {
  const { orderNumber = "" } = useLocalSearchParams<{ orderNumber: string }>();
  const { token, products, addToCart } = useAppStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!token) { setError("Sign in to view this order."); setLoading(false); return; }
    const refresh = () => apiRequest<OrderDetail>(`/orders/${encodeURIComponent(orderNumber)}`, token).then(value => { if (active) { setOrder(value); setError(""); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this order."); }).finally(() => { if (active) setLoading(false); });
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [orderNumber, token]);
  function reorder() {
    if (!order) return;
    let added = 0;
    for (const fulfillment of order.fulfillments) for (const line of fulfillment.lines) {
      const product = products.find((item: Product) => item.offers.some((offer: Offer) => offer.id === line.offerId));
      const offer = product?.offers.find((item: Offer) => item.id === line.offerId);
      if (product && offer) { addToCart(product, offer, line.quantity); added += 1; }
    }
    if (added) router.push("/(tabs)/cart");
    else Alert.alert("Products unavailable", "These offers are no longer in the current catalogue.");
  }
  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.green} style={{ marginTop: 45 }}/></SafeAreaView>;
  if (!order) return <SafeAreaView style={styles.safe} edges={["top"]}><EmptyState title="Order unavailable" detail={error} action={<Button title="Back to orders" onPress={() => router.replace("/(tabs)/orders")}/>}/></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}><Button title="‹  Back to orders" variant="plain" onPress={() => router.back()} style={styles.back}/><Text style={styles.eyebrow}>ORDER DETAILS</Text><Text style={styles.title}>{order.orderNumber}</Text><Text style={styles.subtitle}>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
    <Panel style={styles.summary}><View style={styles.row}><Text style={styles.label}>Order status</Text><Text style={styles.value}>{order.status.replaceAll("_", " ")}</Text></View><View style={styles.row}><Text style={styles.label}>Payment</Text><Text style={styles.value}>{order.paymentMethod === "COD" ? `Cash on delivery · ${order.payments?.[0]?.status === "PAID" ? "Collected" : "Due"}` : "—"}</Text></View><View style={styles.row}><Text style={styles.label}>Subtotal</Text><Text style={styles.value}>{money(order.subtotal)}</Text></View>{Number(order.discountTotal) > 0 && <View style={styles.row}><Text style={styles.label}>Dealer scheme discount</Text><Text style={[styles.value, { color: colors.green }]}>−{money(order.discountTotal)}</Text></View>}<View style={styles.row}><Text style={styles.label}>Tax</Text><Text style={styles.value}>{money(order.taxTotal)}</Text></View><View style={[styles.row, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.total}>{money(order.total)}</Text></View></Panel>
    <Text style={styles.sectionTitle}>Delivery address</Text><Panel><Text style={styles.value}>{order.deliveryName}</Text><Text style={styles.address}>{order.deliveryAddress}, {order.deliveryArea}, {order.deliveryDistrict} {order.deliveryPinCode}</Text></Panel>
    <Text style={styles.sectionTitle}>Items and fulfilment</Text>{order.fulfillments.map(group => <Panel key={group.id} style={styles.fulfillment}><View style={styles.row}><Text style={styles.value}>{group.seller?.name ?? group.fulfillmentNumber}</Text><Text style={styles.status}>{group.shipment?.status?.replaceAll("_", " ") ?? group.status.replaceAll("_", " ")}</Text></View><DeliveryTimeline group={group}/><Text style={styles.source}>{group.source.replaceAll("_", " ")}{group.shipment?.trackingNumber ? ` · Tracking ${group.shipment.trackingNumber}` : ""}</Text>{group.shipment?.events?.map(event => <Text key={`${event.status}-${event.occurredAt}`} style={styles.label}>{new Date(event.occurredAt).toLocaleString()} · {event.status.replaceAll("_", " ")}{event.note ? ` · ${event.note}` : ""}</Text>)}{group.lines.map(line => <View key={line.id} style={styles.line}><View style={{ flex: 1 }}><Text style={styles.value}>{line.productNameSnapshot}</Text><Text style={styles.label}>{line.quantity} × {money(line.unitPriceSnapshot)} · {line.sourceSnapshot.replaceAll("_", " ")}</Text></View><Text style={styles.value}>{money(line.lineTotal)}</Text></View>)}</Panel>)}
    <Button title="Buy these items again" onPress={reorder}/>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 32 }, back: { alignSelf: "flex-start", marginLeft: -8 }, eyebrow: { marginTop: 6, color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { marginTop: 7, color: colors.dark, fontSize: 24, fontWeight: "900" }, subtitle: { marginTop: 4, color: colors.muted, fontSize: 11 }, summary: { marginTop: 17, gap: 12 }, row: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, label: { color: colors.muted, fontSize: 10, lineHeight: 16 }, value: { color: colors.dark, fontSize: 12, fontWeight: "800" }, totalRow: { paddingTop: 10, borderTopWidth: 1, borderColor: colors.line }, totalLabel: { color: colors.dark, fontSize: 13, fontWeight: "800" }, total: { color: colors.dark, fontSize: 16, fontWeight: "900" }, sectionTitle: { marginTop: 22, marginBottom: 10, color: colors.dark, fontSize: 15, fontWeight: "900" }, address: { marginTop: 5, color: colors.muted, fontSize: 11, lineHeight: 17 }, fulfillment: { marginBottom: 10, gap: 9 }, timeline: { marginTop: 6, flexDirection: "row", justifyContent: "space-between" }, stage: { flex: 1, alignItems: "center", position: "relative" }, stageDot: { width: 22, height: 22, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, zIndex: 1 }, stageDotActive: { borderColor: colors.green, backgroundColor: colors.greenTint }, stageCheck: { color: colors.muted, fontSize: 9, fontWeight: "800" }, stageCheckActive: { color: colors.green }, stageLine: { position: "absolute", top: 10, left: "55%", width: "90%", height: 2, backgroundColor: colors.line }, stageLineActive: { backgroundColor: colors.green }, stageLabel: { marginTop: 5, color: colors.muted, fontSize: 7, textAlign: "center" }, stageLabelActive: { color: colors.green, fontWeight: "900" }, status: { color: colors.green, fontSize: 9, fontWeight: "800" }, source: { color: colors.muted, fontSize: 9 }, line: { paddingTop: 9, borderTopWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10 } });
