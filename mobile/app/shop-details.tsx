import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { apiRequest } from "../src/api";
import { useAppStore } from "../src/store";

type ShopDetails = { shopName: string; pinCode: string; city: string; district: string; state: string; shopNumber: string; area: string; landmark: string; verificationStatus: string; isLocked: boolean };
type DetailKey = "shopName" | "pinCode" | "city" | "district" | "state" | "shopNumber" | "area" | "landmark";
const fields: Array<{ key: DetailKey; label: string; caps?: boolean; keyboard?: "default" | "number-pad" }> = [
  { key: "shopName", label: "SHOP NAME", caps: true },
  { key: "pinCode", label: "PINCODE", keyboard: "number-pad" },
  { key: "city", label: "CITY / TEHSIL", caps: true },
  { key: "district", label: "DISTRICT", caps: true },
  { key: "state", label: "STATE" },
  { key: "shopNumber", label: "SHOP NO. / BUILDING", caps: true },
  { key: "area", label: "VILLAGE / AREA / STREET" },
  { key: "landmark", label: "LANDMARK" },
];
const emptyDetails: ShopDetails = { shopName: "", pinCode: "", city: "", district: "", state: "", shopNumber: "", area: "", landmark: "", verificationStatus: "PENDING", isLocked: false };

export default function ShopDetailsScreen() {
  const { token } = useAppStore();
  const [details, setDetails] = useState<ShopDetails>(emptyDetails);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError("");
    try { setDetails(await apiRequest<ShopDetails>("/auth/me/shop-details", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Shop details could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  const refreshVerificationStatus = useCallback(async () => {
    if (!token) return;
    try {
      const latest = await apiRequest<ShopDetails>("/auth/me/shop-details", token);
      setDetails(current => ({ ...current, verificationStatus: latest.verificationStatus, isLocked: latest.isLocked }));
    } catch { /* Keep the last known status until the API is reachable again. */ }
  }, [token]);
  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void refreshVerificationStatus(), 30_000);
    return () => clearInterval(timer);
  }, [load, refreshVerificationStatus]));

  const save = async () => {
    setSaving(true); setError("");
    try { const { shopName, pinCode, city, district, state, shopNumber, area, landmark } = details; setDetails(await apiRequest<ShopDetails>("/auth/me/shop-details", token, { method: "PATCH", body: JSON.stringify({ shopName, pinCode, city, district, state, shopNumber, area, landmark }) })); Alert.alert("Shop details saved", "Your shop information has been updated."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Shop details could not be saved."); }
    finally { setSaving(false); }
  };

  const contactSupport = async () => {
    const url = "https://wa.me/919933329102?text=Please%20help%20me%20update%20my%20verified%20shop%20details.";
    try { await Linking.openURL(url); } catch { await Linking.openURL("mailto:support@agri-one.in?subject=Shop%20details%20change"); }
  };
  const statusLabel = details.verificationStatus === "APPROVED" ? "✓ Verified" : details.verificationStatus === "REJECTED" || details.verificationStatus === "NEEDS_CORRECTION" ? "Needs update" : "Pending";

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>Shop Details</Text><View style={[styles.statusBadge, details.isLocked ? styles.verifiedBadge : styles.pendingBadge]}><Text style={[styles.statusText, details.isLocked ? styles.verifiedText : styles.pendingText]}>{statusLabel}</Text></View></View>
    {!token ? <View style={styles.center}><Text style={styles.centerTitle}>Sign in to view shop details</Text><Pressable onPress={() => router.push("/login")} style={styles.saveButton}><Text style={styles.saveText}>Sign in</Text></Pressable></View> : loading ? <ActivityIndicator style={{ marginTop: 34 }} color="#00834F" /> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {details.isLocked ? <View style={styles.lockBanner}><Text style={styles.lockIcon}>🔒</Text><View style={styles.lockCopy}><Text style={styles.lockTitle}>These details are locked</Text><Text style={styles.lockText}>Shop information is verified and can't be edited from the app. To change anything, please contact our team.</Text></View></View> : <View style={styles.editBanner}><Text style={styles.lockTitle}>Complete your shop details</Text><Text style={styles.lockText}>These details will be used to verify your retailer account.</Text></View>}
      <Text style={styles.sectionLabel}>SHOP DETAILS</Text>
      <View style={styles.detailsCard}>{fields.map((field, index) => <View key={field.key} style={[styles.detailRow, index === fields.length - 1 && styles.lastRow]}><Text style={styles.fieldLabel}>{field.label}</Text>{details.isLocked ? <Text style={[styles.value, field.caps && styles.uppercase]}>{details[field.key] || "—"}</Text> : <TextInput value={details[field.key]} onChangeText={value => setDetails(current => ({ ...current, [field.key]: value }))} placeholder={`Enter ${field.label.toLowerCase()}`} placeholderTextColor="#A5AAA7" keyboardType={field.keyboard ?? "default"} autoCapitalize={field.caps ? "characters" : "words"} style={[styles.input, field.caps && styles.uppercase]} />}</View>)}</View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {details.isLocked ? <Pressable accessibilityRole="button" onPress={() => void contactSupport()} style={({ pressed }) => [styles.supportButton, pressed && styles.pressed]}><Text style={styles.supportText}>Contact Support to Edit</Text><Text style={styles.chatIcon}>◉</Text></Pressable> : <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save Shop Details</Text>}</Pressable>}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#FFFFFF" }, header: { minHeight: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: "#ECECEC" }, backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 18 }, back: { color: "#181818", fontSize: 23, lineHeight: 26 }, title: { flex: 1, color: "#141414", fontSize: 19, fontWeight: "900", letterSpacing: -0.5 }, statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderRadius: 18 }, verifiedBadge: { borderColor: "#A9DCC3", backgroundColor: "#ECF9F2" }, pendingBadge: { borderColor: "#E8D69C", backgroundColor: "#FFF8DF" }, statusText: { fontSize: 10, fontWeight: "900" }, verifiedText: { color: "#087D48" }, pendingText: { color: "#94701B" }, content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 }, lockBanner: { minHeight: 71, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderColor: "#E9D483", borderRadius: 10, backgroundColor: "#FFF2C4" }, editBanner: { minHeight: 58, padding: 13, borderWidth: 1, borderColor: "#E9D483", borderRadius: 10, backgroundColor: "#FFF2C4" }, lockIcon: { marginTop: 1, color: "#89680C", fontSize: 20 }, lockCopy: { flex: 1 }, lockTitle: { color: "#242016", fontSize: 13, fontWeight: "900" }, lockText: { marginTop: 5, color: "#88816E", fontSize: 10, lineHeight: 14, fontWeight: "600" }, sectionLabel: { marginTop: 16, marginBottom: 8, marginLeft: 4, color: "#999999", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, detailsCard: { overflow: "hidden", borderWidth: 1, borderColor: "#E7E7E7", borderRadius: 10, backgroundColor: "#FFFFFF" }, detailRow: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 9, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }, lastRow: { borderBottomWidth: 0 }, fieldLabel: { color: "#9B9B9B", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }, value: { marginTop: 5, color: "#202020", fontSize: 13, fontWeight: "700" }, uppercase: { textTransform: "uppercase" }, input: { minHeight: 24, marginTop: 3, padding: 0, color: "#202020", fontSize: 13, fontWeight: "700" }, supportButton: { minHeight: 46, marginTop: 17, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 10, backgroundColor: "#00834F" }, supportText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, chatIcon: { color: "#FFFFFF", fontSize: 17 }, saveButton: { minHeight: 46, marginTop: 16, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#00834F" }, saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, error: { marginTop: 10, color: "#B94A36", fontSize: 10, lineHeight: 15 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }, centerTitle: { color: "#202020", fontSize: 15, fontWeight: "800" }, pressed: { opacity: 0.82 }, disabled: { opacity: 0.6 } });
