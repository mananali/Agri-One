import { AgriText as Text, AgriTextInput as TextInput } from "../../components/AgriText";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Panel } from "../../components/Controls";
import { apiRequest, imageSource, money, type Order, type Offer, type Product } from "../../src/api";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

type OrderFilter = "ALL" | "IN_TRANSIT" | "DELIVERED";
const delivered = (status: string) => status === "DELIVERED";
const inTransit = (status: string) => status === "DISPATCHED" || status === "PARTIALLY_DISPATCHED";
const titleStatus = (status: string) => status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

export default function OrdersScreen() {
  const { token, user, products, addToCart } = useAppStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [returningOrder, setReturningOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      if (user?.role === "SUPPLIER") {
        const fulfillments = await apiRequest<Array<{ id: string; fulfillmentNumber: string; status: string; total: number | string; createdAt: string; customerOrder: { orderNumber: string } }>>("/orders", token);
        setOrders(fulfillments.map(item => ({ id: item.id, orderNumber: item.customerOrder.orderNumber, status: item.status, total: item.total, createdAt: item.createdAt })));
      } else setOrders(await apiRequest<Order[]>("/orders", token));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load orders."); }
    finally { setLoading(false); }
  }, [token, user?.role]);
  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]));

  const counts = useMemo(() => ({ all: orders.length, transit: orders.filter(order => inTransit(order.status)).length, delivered: orders.filter(order => delivered(order.status)).length }), [orders]);
  const visibleOrders = useMemo(() => orders.filter(order => {
    if (filter === "IN_TRANSIT" && !inTransit(order.status)) return false;
    if (filter === "DELIVERED" && !delivered(order.status)) return false;
    const haystack = `${order.orderNumber} ${order.status} ${order.fulfillments?.flatMap(group => group.lines.map(line => line.productNameSnapshot)).join(" ") ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [orders, filter, query]);

  function reorder(order: Order) {
    let added = 0;
    for (const group of order.fulfillments ?? []) for (const line of group.lines) {
      const product = products.find((item: Product) => item.offers.some((offer: Offer) => offer.id === line.offerId));
      const offer = product?.offers.find((item: Offer) => item.id === line.offerId);
      if (product && offer) { addToCart(product, offer, line.quantity); added += 1; }
    }
    if (added) router.push("/(tabs)/cart");
    else router.push({ pathname: "/order/[orderNumber]", params: { orderNumber: order.orderNumber } });
  }

  async function submitReturn() {
    if (!token || !returningOrder || returnReason.trim().length < 5) return;
    setSubmittingReturn(true);
    try {
      await apiRequest(`/orders/${encodeURIComponent(returningOrder.orderNumber)}/returns`, token, { method: "POST", body: JSON.stringify({ reason: returnReason.trim() }) });
      setReturningOrder(null); setReturnReason("");
      await load();
      Alert.alert("Return requested", "Your return request was sent for review.");
    } catch (cause) { Alert.alert("Could not request return", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setSubmittingReturn(false); }
  }

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <View style={styles.heading}>
      <View style={{ flex: 1 }}>
        {searching ? <TextInput autoFocus placeholder="Search order or product" value={query} onChangeText={setQuery} style={styles.searchInput} returnKeyType="search" /> : <Text style={styles.title}>My Orders</Text>}
        <Text style={styles.hint}>{counts.all} {counts.all === 1 ? "order" : "orders"} this month</Text>
      </View>
      <Pressable accessibilityLabel={searching ? "Close search" : "Search orders"} onPress={() => { setSearching(value => !value); setQuery(""); }} style={styles.searchButton}><Text style={styles.searchIcon}>{searching ? "×" : "⌕"}</Text></Pressable>
    </View>

    <View style={styles.tabs}>{([
      ["ALL", `All (${counts.all})`], ["IN_TRANSIT", `In Transit (${counts.transit})`], ["DELIVERED", `Delivered (${counts.delivered})`],
    ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.tab, filter === key && styles.activeTab]}><Text style={[styles.tabText, filter === key && styles.activeTabText]}>{label}</Text></Pressable>)}</View>

    {!token ? <EmptyState title="Sign in to view orders" detail="Your confirmed orders will appear here." action={<Button title="Sign in" onPress={() => router.push("/login")}/>}/> : loading && orders.length === 0 ? <ActivityIndicator style={{ marginTop: 35 }} color={colors.green}/> : error ? <EmptyState title="Could not load orders" detail={error} action={<Button title="Try again" onPress={() => void load()}/>}/> : orders.length === 0 ? <EmptyState title="No orders yet" detail="Once you place an order, you can follow its status here." action={<Button title="Browse products" onPress={() => router.replace("/(tabs)")}/>}/> : visibleOrders.length === 0 ? <EmptyState title="No matching orders" detail="Try another tab or search term."/> : <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {visibleOrders.map(order => {
        const lines = order.fulfillments?.flatMap(group => group.lines) ?? [];
        const firstLine = lines[0];
        const itemImage = imageSource(firstLine?.offer?.product?.imageUrl ?? firstLine?.imageUrl);
        const status = order.status ?? "PLACED";
        const isDelivered = delivered(status);
        const activeReturn = order.returnRequests?.find(item => item.status === "REQUESTED" || item.status === "APPROVED");
        return <Panel key={order.id} style={styles.orderCard}>
          <Pressable onPress={() => router.push({ pathname: "/order/[orderNumber]", params: { orderNumber: order.orderNumber } })}>
            <View style={styles.orderTop}><Text style={[styles.statusMark, !isDelivered && styles.pendingStatus]}>{isDelivered ? "✓  DELIVERED" : `●  ${titleStatus(status).toUpperCase()}`}</Text><Text style={styles.date}>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></View>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            <View style={styles.productPreview}>
              {itemImage ? <Image source={itemImage} style={styles.productImage} resizeMode="contain"/> : <View style={styles.productPlaceholder}><Text style={styles.productPlaceholderText}>▧</Text></View>}
              <View style={styles.productInfo}><Text numberOfLines={2} style={styles.productName}>{firstLine?.productNameSnapshot ?? (lines.length ? `${lines.length} items` : "Order items")}</Text>{lines.length > 1 && <Text style={styles.moreItems}>+{lines.length - 1} more item{lines.length > 2 ? "s" : ""}</Text>}</View>
            </View>
            <View style={styles.cardDivider}/>
            <View style={styles.totalRow}><Text style={styles.total}>{money(order.total)}</Text><Text style={[styles.statusLabel, isDelivered && styles.deliveredLabel]}>{activeReturn ? `Return ${titleStatus(activeReturn.status)}` : titleStatus(status)}</Text></View>
            {order.paymentMethod === "COD" && <Text style={styles.moreItems}>Cash on delivery · {order.payments?.[0]?.status === "PAID" ? "Cash collected" : "Pay at delivery"}</Text>}
          </Pressable>
          {user?.role !== "SUPPLIER" && <View style={styles.actions}>
            <Pressable style={styles.secondaryAction} onPress={() => router.push({ pathname: "/order-invoice", params: { orderNumber: order.orderNumber } })}><Text style={styles.secondaryActionText}>INVOICE</Text></Pressable>
            <Pressable style={[styles.secondaryAction, (!isDelivered || !!activeReturn) && styles.disabledAction]} disabled={!isDelivered || !!activeReturn} onPress={() => { setReturningOrder(order); setReturnReason(""); }}><Text style={[styles.secondaryActionText, (!isDelivered || !!activeReturn) && styles.disabledText]}>{activeReturn ? "REQUESTED" : "RETURN"}</Text></Pressable>
            <Pressable style={styles.primaryAction} onPress={() => reorder(order)}><Text style={styles.primaryActionText}>REORDER</Text></Pressable>
          </View>}
        </Panel>;
      })}
    </ScrollView>}

    {!!token && <Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>↻  Refresh orders</Text></Pressable>}

    <Modal transparent visible={!!returningOrder} animationType="slide" onRequestClose={() => setReturningOrder(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Request a return</Text><Text style={styles.modalSubtitle}>Order #{returningOrder?.orderNumber}</Text><Text style={styles.fieldLabel}>Reason for return</Text><TextInput multiline textAlignVertical="top" maxLength={1000} value={returnReason} onChangeText={setReturnReason} placeholder="Tell us why you want to return this order" style={styles.reasonInput}/><View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={() => setReturningOrder(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={submittingReturn || returnReason.trim().length < 5} style={[styles.primaryAction, (submittingReturn || returnReason.trim().length < 5) && styles.disabledAction]} onPress={() => void submitReturn()}><Text style={styles.primaryActionText}>{submittingReturn ? "SENDING…" : "SUBMIT REQUEST"}</Text></Pressable></View></View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F7F7" },
  heading: { minHeight: 78, backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#E9E9E9", gap: 12 },
  title: { color: "#171717", fontSize: 26, fontWeight: "900" }, hint: { marginTop: 4, color: "#6D6D6D", fontSize: 13 },
  searchButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "#E8E8E8", alignItems: "center", justifyContent: "center" }, searchIcon: { color: "#171717", fontSize: 29, lineHeight: 34 }, searchInput: { paddingVertical: 6, fontSize: 17, color: "#171717" },
  tabs: { height: 53, flexDirection: "row", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#E8E8E8" }, tab: { flex: 1, justifyContent: "center", alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" }, activeTab: { borderBottomColor: "#008354" }, tabText: { fontSize: 14, color: "#666666", fontWeight: "500" }, activeTabText: { color: "#007B50", fontWeight: "800" },
  list: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 15, gap: 13 }, orderCard: { padding: 16, backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#E8E8E8", shadowColor: "#000000", shadowOpacity: 0.025, shadowRadius: 3, elevation: 1 }, orderTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, statusMark: { color: "#00845A", fontSize: 12, fontWeight: "900" }, pendingStatus: { color: "#9B7A22" }, date: { color: "#767676", fontSize: 12 }, orderNumber: { marginTop: 14, color: "#777777", fontSize: 13 }, productPreview: { minHeight: 96, flexDirection: "row", alignItems: "center", gap: 13, marginTop: 6, marginBottom: 7 }, productImage: { width: 76, height: 82 }, productPlaceholder: { width: 76, height: 82, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F8F8", borderRadius: 8 }, productPlaceholderText: { fontSize: 30, color: "#9C9C9C" }, productInfo: { flex: 1 }, productName: { color: "#404040", fontSize: 13, fontWeight: "600" }, moreItems: { marginTop: 5, color: "#8A8A8A", fontSize: 11 }, cardDivider: { height: 1, backgroundColor: "#ECECEC", marginTop: 6, marginBottom: 12 }, totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, total: { color: "#191919", fontSize: 20, fontWeight: "900" }, statusLabel: { color: "#9B7A22", fontSize: 14, fontWeight: "700" }, deliveredLabel: { color: "#C19A2D" },
  actions: { marginTop: 17, flexDirection: "row", gap: 9 }, secondaryAction: { minHeight: 43, flex: 1, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: "#E7E7E7", alignItems: "center", justifyContent: "center" }, secondaryActionText: { color: "#171717", fontSize: 11, fontWeight: "900" }, primaryAction: { minHeight: 43, flex: 1, paddingHorizontal: 7, borderRadius: 12, backgroundColor: "#078C12", alignItems: "center", justifyContent: "center" }, primaryActionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" }, disabledAction: { backgroundColor: "#F1F1F1", borderColor: "#E5E5E5" }, disabledText: { color: "#A0A0A0" },
  refresh: { alignSelf: "center", padding: 10 }, refreshText: { color: colors.green, fontSize: 12, fontWeight: "700" }, modalBackdrop: { flex: 1, padding: 22, justifyContent: "center", backgroundColor: "rgba(0,0,0,.38)" }, modalCard: { padding: 20, borderRadius: 20, backgroundColor: "#FFFFFF" }, modalTitle: { color: "#171717", fontSize: 20, fontWeight: "900" }, modalSubtitle: { marginTop: 5, marginBottom: 20, color: "#767676", fontSize: 13 }, fieldLabel: { color: "#4B4B4B", fontSize: 12, fontWeight: "800" }, reasonInput: { minHeight: 105, marginTop: 9, padding: 12, borderWidth: 1, borderColor: "#E2E2E2", borderRadius: 12, fontSize: 14 }, modalActions: { marginTop: 16, flexDirection: "row", gap: 10 }, cancelButton: { minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E5E5", borderRadius: 12 }, cancelText: { color: "#444444", fontSize: 13, fontWeight: "700" },
});
