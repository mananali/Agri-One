import { AgriText as Text } from "../components/AgriText";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Field, Panel } from "../components/Controls";
import { apiRequest, money, type DeliveryAddress } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

type CreatedOrder = { orderNumber: string; total: number | string };

export default function CheckoutScreen() {
  const { token, user, organization, cart, clearCart } = useAppStore();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [district, setDistrict] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const checkoutAttempt = useRef<{ signature: string; key: string } | null>(null);
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);

  useEffect(() => {
    if (!token || user?.role !== "RETAILER") return;
    let active = true;
    void apiRequest<DeliveryAddress[]>("/orders/addresses", token).then(addresses => {
      if (!active) return;
      const saved = addresses.find(item => item.isDefault) ?? addresses[0];
      if (saved) {
        setName(saved.recipientName); setPhone(saved.phone); setAddress(saved.address);
        setArea(saved.area); setDistrict(saved.district); setPinCode(saved.pinCode);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [token, user?.role]);

  async function placeOrder() {
    setError("");
    if (!token) { router.replace({ pathname: "/login", params: { next: "checkout" } }); return; }
    if (user?.role !== "RETAILER") { setError("Checkout is available to retailer accounts only."); return; }
    if (cart.some(line => line.offerId.startsWith("demo-offer-"))) {
      setError("Your cart includes sample listings. Remove them and add products from the live catalogue before placing an order.");
      return;
    }
    if (organization?.verificationStatus !== "APPROVED") {
      setError("Your retailer account must be verified before checkout. You can still save items in your cart.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    const deliveryPhone = phoneDigits.length === 10 ? `+91${phoneDigits}` : phoneDigits.length === 12 && phoneDigits.startsWith("91") ? `+${phoneDigits}` : phone.trim();
    if (!name.trim() || !/^(\+91)?[6-9]\d{9}$/.test(deliveryPhone.replace(/[\s()-]/g, "")) || address.trim().length < 8 || !area.trim() || !district.trim() || !/^\d{6}$/.test(pinCode)) {
      setError("Enter your contact and delivery details. The PIN code must contain 6 digits.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        items: cart.map(line => ({ offerId: line.offerId, quantity: line.quantity })),
        deliveryName: name.trim(), deliveryPhone, deliveryAddress: address.trim(),
        deliveryArea: area.trim(), deliveryDistrict: district.trim(), deliveryPinCode: pinCode,
      };
      const signature = JSON.stringify(payload);
      let attempt = checkoutAttempt.current;
      if (!attempt || attempt.signature !== signature) {
        attempt = { signature, key: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}` };
        checkoutAttempt.current = attempt;
      }
      const order = await apiRequest<CreatedOrder>("/orders/checkout", token, {
        method: "POST",
        headers: { "Idempotency-Key": attempt.key },
        body: JSON.stringify(payload),
      });
      checkoutAttempt.current = null;
      clearCart();
      Alert.alert("Order placed", `${order.orderNumber}\nTotal: ${money(order.total)}`, [
        { text: "View orders", onPress: () => router.replace("/(tabs)/orders") },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not place your order. Please try again.");
    } finally { setBusy(false); }
  }

  if (!token) {
    return <SafeAreaView style={styles.safe} edges={["top"]}><View style={styles.empty}><Text style={styles.title}>Sign in to checkout</Text><Text style={styles.hint}>Your cart will be ready when you return.</Text><Button title="Sign in" onPress={() => router.replace({ pathname: "/login", params: { next: "checkout" } })}/></View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe} edges={["top"]}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Button title="‹  Back to cart" variant="plain" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/cart")} style={styles.back}/>
      <Text style={styles.eyebrow}>ORDER DETAILS</Text><Text style={styles.title}>Checkout</Text>
      <Text style={styles.hint}>Where should we deliver your order?</Text>
      <Panel style={styles.summary}><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Items</Text><Text style={styles.summaryValue}>{cart.reduce((n, line) => n + line.quantity, 0)}</Text></View><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryTotal}>{money(subtotal)}</Text></View><Text style={styles.note}>Final taxes and availability are confirmed by the server when you place the order.</Text></Panel>
      <Panel style={styles.summary}><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment</Text><Text style={styles.summaryValue}>Cash on Delivery</Text></View><Text style={styles.note}>Pay the order total in cash when your delivery arrives. Online payment is not enabled.</Text></Panel>
      {cart.length === 0 ? <Panel style={styles.emptyCart}><Text style={styles.body}>Your cart is empty.</Text><Button title="Browse products" onPress={() => router.replace("/(tabs)")}/></Panel> : <>
        <View style={styles.form}>
          <Field label="Recipient name" placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Phone number" placeholder="+91 98765 43210" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Street address" placeholder="House, street and landmark" value={address} onChangeText={setAddress} multiline />
          <Field label="Area / town" placeholder="Area or town" value={area} onChangeText={setArea} />
          <View style={styles.row}><View style={styles.half}><Field label="District" placeholder="District" value={district} onChangeText={setDistrict} autoCapitalize="words" /></View><View style={styles.half}><Field label="PIN code" placeholder="6 digits" value={pinCode} onChangeText={value => setPinCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} /></View></View>
        </View>
        {organization?.verificationStatus !== "APPROVED" && <Text style={styles.notice}>Business verification is required before checkout.</Text>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Button title="Place order" loading={busy} onPress={placeOrder} />
      </>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, flex: { flex: 1 }, content: { padding: 19, paddingBottom: 32 }, back: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 5 }, eyebrow: { marginTop: 7, color: colors.green, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 }, title: { marginTop: 7, color: colors.dark, fontSize: 27, fontWeight: "900" }, hint: { marginTop: 5, marginBottom: 17, color: colors.muted, fontSize: 12, lineHeight: 18 }, summary: { marginBottom: 20, gap: 10 }, summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, summaryLabel: { color: colors.muted, fontSize: 12 }, summaryValue: { color: colors.dark, fontSize: 12, fontWeight: "800" }, summaryTotal: { color: colors.dark, fontSize: 17, fontWeight: "900" }, note: { color: colors.muted, fontSize: 10, lineHeight: 15 }, form: { gap: 14 }, row: { flexDirection: "row", gap: 10 }, half: { flex: 1 }, notice: { marginTop: 13, color: colors.orange, fontSize: 11, lineHeight: 16 }, error: { marginTop: 13, padding: 11, borderRadius: 9, backgroundColor: "#FFF0ED", color: colors.red, fontSize: 11, lineHeight: 16 }, empty: { flex: 1, padding: 24, justifyContent: "center", gap: 12 }, body: { color: colors.muted, fontSize: 13 }, emptyCart: { gap: 12 } });
