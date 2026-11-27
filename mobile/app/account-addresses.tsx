import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { apiRequest, type DeliveryAddress } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

type AddressForm = Omit<DeliveryAddress, "id" | "createdAt" | "updatedAt">;
const blank: AddressForm = { label: "Home", recipientName: "", phone: "", address: "", area: "", district: "", pinCode: "", isDefault: false };

function Input({ label, value, onChangeText, keyboardType = "default", multiline = false, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "phone-pad" | "number-pad"; multiline?: boolean; maxLength?: number }) {
  return <View style={styles.inputGroup}><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} maxLength={maxLength} placeholder={label} placeholderTextColor="#9BA49D" style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function AddressesScreen() {
  const { token } = useAppStore();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [form, setForm] = useState<AddressForm>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof AddressForm>(key: K, value: AddressForm[K]) => setForm(current => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try { setAddresses(await apiRequest<DeliveryAddress[]>("/orders/addresses", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Addresses could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const startEdit = (address: DeliveryAddress) => {
    const { id, createdAt, updatedAt, ...values } = address;
    setEditingId(id); setForm(values); setShowForm(true); setError("");
  };
  const startAdd = () => { setEditingId(null); setForm({ ...blank, isDefault: addresses.length === 0 }); setShowForm(true); setError(""); };
  const save = async () => {
    setError("");
    const phone = form.phone.replace(/[\s()-]/g, "");
    if (form.recipientName.trim().length < 2 || form.address.trim().length < 8 || !form.area.trim() || !form.district.trim() || !/^\d{6}$/.test(form.pinCode) || !/^\+?[1-9]\d{7,14}$/.test(phone)) {
      setError("Enter the recipient, valid phone, full street address, area, district and 6-digit PIN code."); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, phone, recipientName: form.recipientName.trim(), address: form.address.trim(), area: form.area.trim(), district: form.district.trim(), pinCode: form.pinCode.trim() };
      if (editingId) await apiRequest(`/orders/addresses/${editingId}`, token, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiRequest("/orders/addresses", token, { method: "POST", body: JSON.stringify(payload) });
      setShowForm(false); setEditingId(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Address could not be saved."); }
    finally { setSaving(false); }
  };
  const remove = (id: string) => Alert.alert("Remove address?", "This delivery address will be deleted from your Agri-One account.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => { try { await apiRequest(`/orders/addresses/${id}`, token, { method: "DELETE" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Address could not be removed."); } } },
  ]);
  const setDefault = async (address: DeliveryAddress) => {
    try { await apiRequest(`/orders/addresses/${address.id}`, token, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Default address could not be updated."); }
  };

  if (!token) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Sign in to manage addresses</Text><Pressable style={styles.addButton} onPress={() => router.push("/login")}><Text style={styles.addText}>Sign in</Text></Pressable></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Delivery Addresses</Text><Pressable accessibilityRole="button" onPress={startAdd}><Text style={styles.headerAction}>＋ Add</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {showForm && <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? "Edit address" : "Add delivery address"}</Text>
        <View style={styles.twoCols}><View style={styles.col}><Input label="Label (Home / Shop)" value={form.label} onChangeText={value => set("label", value)} maxLength={40} /></View><View style={styles.col}><Input label="Recipient name" value={form.recipientName} onChangeText={value => set("recipientName", value)} maxLength={120} /></View></View>
        <Input label="Phone number" value={form.phone} onChangeText={value => set("phone", value)} keyboardType="phone-pad" maxLength={18} />
        <Input label="Street address" value={form.address} onChangeText={value => set("address", value)} multiline maxLength={300} />
        <Input label="Area / town" value={form.area} onChangeText={value => set("area", value)} maxLength={100} />
        <View style={styles.twoCols}><View style={styles.col}><Input label="District" value={form.district} onChangeText={value => set("district", value)} maxLength={100} /></View><View style={styles.col}><Input label="PIN code" value={form.pinCode} onChangeText={value => set("pinCode", value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} /></View></View>
        <View style={styles.defaultRow}><Text style={styles.defaultLabel}>Set as default address</Text><Switch value={form.isDefault} onValueChange={value => set("isDefault", value)} trackColor={{ false: "#CFD7D1", true: "#8DC5A5" }} thumbColor={form.isDefault ? colors.green : "#F5F7F5"} /></View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}><Pressable onPress={() => { setShowForm(false); setError(""); }} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>{saving ? "Saving…" : "Save address"}</Text></Pressable></View>
      </View>}
      {!!error && !showForm && <Text style={styles.error}>{error}</Text>}
      {loading && addresses.length === 0 ? <ActivityIndicator style={{ marginTop: 28 }} color={colors.green} /> : addresses.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No saved addresses</Text><Text style={styles.emptyText}>Add a delivery address to use it again at checkout.</Text><Pressable onPress={startAdd} style={styles.addButton}><Text style={styles.addText}>＋ Add address</Text></Pressable></View> : addresses.map(address => <View key={address.id} style={styles.addressCard}>
        <View style={styles.addressTop}><View style={styles.pinIcon}><Text style={styles.pinGlyph}>⌖</Text></View><View style={styles.addressNameWrap}><Text style={styles.addressName}>{address.label}</Text>{address.isDefault && <Text style={styles.defaultBadge}>DEFAULT</Text>}</View><Pressable accessibilityRole="button" onPress={() => startEdit(address)}><Text style={styles.edit}>Edit</Text></Pressable></View>
        <Text style={styles.recipient}>{address.recipientName}  ·  {address.phone}</Text><Text style={styles.addressText}>{address.address}, {address.area}, {address.district} {address.pinCode}</Text>
        <View style={styles.addressActions}>{!address.isDefault && <Pressable onPress={() => void setDefault(address)}><Text style={styles.setDefault}>Set as default</Text></Pressable>}<Pressable onPress={() => remove(address.id)}><Text style={styles.remove}>Remove</Text></Pressable></View>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white }, back: { width: 27, color: colors.dark, fontSize: 34 }, headerTitle: { color: colors.dark, fontSize: 15, fontWeight: "900" }, headerAction: { color: colors.green, fontSize: 11, fontWeight: "900" }, content: { padding: 16, paddingBottom: 30, gap: 11 }, formCard: { marginBottom: 4, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.white }, formTitle: { marginBottom: 12, color: colors.dark, fontSize: 15, fontWeight: "900" }, twoCols: { flexDirection: "row", gap: 10 }, col: { flex: 1 }, inputGroup: { marginBottom: 11 }, inputLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" }, input: { minHeight: 40, marginTop: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, color: colors.dark, backgroundColor: "#FCFDFC", fontSize: 11 }, multiline: { minHeight: 62, paddingTop: 10, textAlignVertical: "top" }, defaultRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, defaultLabel: { color: colors.dark, fontSize: 10, fontWeight: "700" }, actions: { marginTop: 8, flexDirection: "row", gap: 8 }, cancel: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 9 }, cancelText: { color: colors.muted, fontSize: 10, fontWeight: "800" }, save: { flex: 1.4, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.green }, saveText: { color: colors.white, fontSize: 10, fontWeight: "900" }, error: { marginVertical: 7, color: colors.red, fontSize: 10, lineHeight: 15 }, empty: { padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.white }, emptyTitle: { color: colors.dark, fontSize: 14, fontWeight: "900" }, emptyText: { marginTop: 5, color: colors.muted, fontSize: 10, textAlign: "center" }, addButton: { marginTop: 12, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.green }, addText: { color: colors.white, fontSize: 10, fontWeight: "900" }, addressCard: { padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white }, addressTop: { flexDirection: "row", alignItems: "center" }, pinIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.greenTint }, pinGlyph: { color: colors.green, fontSize: 19 }, addressNameWrap: { flex: 1, marginLeft: 9, flexDirection: "row", alignItems: "center", gap: 8 }, addressName: { color: colors.dark, fontSize: 12, fontWeight: "900" }, defaultBadge: { color: colors.green, fontSize: 7, fontWeight: "900" }, edit: { color: colors.green, fontSize: 10, fontWeight: "900" }, recipient: { marginTop: 11, color: colors.dark, fontSize: 11, fontWeight: "700" }, addressText: { marginTop: 4, color: colors.muted, fontSize: 10, lineHeight: 15 }, addressActions: { marginTop: 11, paddingTop: 9, flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, setDefault: { color: colors.green, fontSize: 9, fontWeight: "900" }, remove: { color: colors.red, fontSize: 9, fontWeight: "800" }, center: { flex: 1, justifyContent: "center", alignItems: "center" }, title: { color: colors.dark, fontSize: 15, fontWeight: "900" } });
