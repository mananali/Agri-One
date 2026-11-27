import { AgriText as Text, AgriTextInput as TextInput } from "../../components/AgriText";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Button, Panel } from "../../components/Controls";
import { apiRequest, type Product, type RetailerStock } from "../../src/api";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

export default function StockScreen() {
  const { token, products } = useAppStore();
  const [rows, setRows] = useState<RetailerStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<RetailerStock | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [quantity, setQuantity] = useState("0");
  const [threshold, setThreshold] = useState("5");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try { setRows(await apiRequest<RetailerStock[]>("/retailer/stock", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Shop stock could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const choices = useMemo(() => products.filter(product => !rows.some(row => row.product.id === product.id) && `${product.name} ${product.category.name}`.toLowerCase().includes(search.toLowerCase())), [products, rows, search]);
  const lowStockCount = rows.filter(row => row.quantity <= row.lowStockThreshold).length;
  const openAdd = () => { setEditing(null); setSelected(null); setQuantity("0"); setThreshold("5"); setSearch(""); setModalOpen(true); };
  const openEdit = (row: RetailerStock) => { setEditing(row); setSelected(null); setQuantity(String(row.quantity)); setThreshold(String(row.lowStockThreshold)); setModalOpen(true); };
  const save = async () => {
    const qty = Number(quantity); const low = Number(threshold);
    if (!token || (!editing && !selected) || !Number.isInteger(qty) || qty < 0 || !Number.isInteger(low) || low < 0) { setError("Enter a valid whole-number quantity and low-stock level."); return; }
    setSaving(true); setError("");
    try {
      if (editing) await apiRequest(`/retailer/stock/${editing.id}`, token, { method: "PATCH", body: JSON.stringify({ quantity: qty, lowStockThreshold: low }) });
      else await apiRequest("/retailer/stock", token, { method: "POST", body: JSON.stringify({ productId: selected!.id, quantity: qty, lowStockThreshold: low }) });
      setEditing(null); setSelected(null); setModalOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Stock could not be saved."); }
    finally { setSaving(false); }
  };
  const remove = (row: RetailerStock) => Alert.alert("Remove stock item?", row.product.name, [{ text: "Keep", style: "cancel" }, { text: "Remove", style: "destructive", onPress: async () => { try { await apiRequest(`/retailer/stock/${row.id}`, token, { method: "DELETE" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Stock item could not be removed."); } } }]);

  if (!token) return <SafeAreaView style={styles.safe} edges={["top"]}><View style={styles.center}><Text style={styles.title}>Sign in to manage shop stock</Text><Button title="Sign in" onPress={() => router.push("/login")}/></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <View style={styles.header}><View><Text style={styles.title}>My Shop Stock</Text><Text style={styles.subtitle}>{rows.length} products · {lowStockCount} running low</Text></View><Pressable accessibilityRole="button" onPress={openAdd} style={styles.add}><Text style={styles.addText}>+ Add</Text></Pressable></View>
    {error ? <Pressable onPress={() => void load()} style={styles.errorBox}><Text style={styles.error}>{error}  Tap to retry.</Text></Pressable> : null}
    {loading && !rows.length ? <ActivityIndicator style={{ marginTop: 36 }} color={colors.green}/> : <FlatList data={rows} keyExtractor={item => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <Panel style={styles.card}><View style={styles.cardTop}><View style={styles.productCopy}><Text style={styles.productName}>{item.product.name}</Text><Text style={styles.meta}>{item.product.category.name} · {item.product.packSize} {item.product.unit}</Text></View><Text style={[styles.stock, item.quantity <= item.lowStockThreshold && styles.low]}>{item.quantity} in stock</Text></View><View style={styles.cardBottom}><Text style={styles.meta}>{item.quantity <= item.lowStockThreshold ? "Low stock · " : "Restock alert at "}{item.lowStockThreshold}</Text><View style={styles.actions}><Pressable onPress={() => openEdit(item)}><Text style={styles.link}>Edit</Text></Pressable><Pressable onPress={() => remove(item)}><Text style={styles.remove}>Remove</Text></Pressable></View></View></Panel>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Your shop stock is empty</Text><Text style={styles.meta}>Add products you keep in your store to track quantities and low-stock alerts.</Text><Button title="Add first product" onPress={openAdd} style={{ marginTop: 15 }}/></View>} />}
    <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => { setEditing(null); setSelected(null); setModalOpen(false); }}>
      <View style={styles.shade}><View style={styles.modal}><View style={styles.modalTop}><Text style={styles.modalTitle}>{editing ? "Update shop stock" : selected ? "Set starting stock" : "Add a product to stock"}</Text><Pressable onPress={() => { setEditing(null); setSelected(null); setModalOpen(false); }}><Text style={styles.close}>×</Text></Pressable></View>
        {!editing && !selected ? <><TextInput value={search} onChangeText={setSearch} placeholder="Find a catalogue product" style={styles.search}/><ScrollView style={styles.choices}>{choices.map(product => <Pressable key={product.id} onPress={() => { setSelected(product); setQuantity("0"); }} style={styles.choice}><Text style={styles.productName}>{product.name}</Text><Text style={styles.meta}>{product.category.name} · {product.packSize} {product.unit}</Text></Pressable>)}</ScrollView>{choices.length === 0 && <Text style={styles.meta}>No more live products to add.</Text>}</> : <><Text style={styles.selectedName}>{editing?.product.name ?? selected?.name}</Text><TextInput value={quantity} onChangeText={value => setQuantity(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="Units in shop" style={styles.input}/><Text style={styles.inputLabel}>Alert when stock reaches</Text><TextInput value={threshold} onChangeText={value => setThreshold(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="Low stock threshold" style={styles.input}/><Button title={saving ? "Saving…" : editing ? "Save stock" : "Add to shop stock"} loading={saving} onPress={() => void save()} style={{ marginTop: 14 }}/></>}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 77, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.line }, title: { color: colors.dark, fontSize: 22, fontWeight: "900" }, subtitle: { marginTop: 4, color: colors.muted, fontSize: 10 }, add: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, backgroundColor: colors.green }, addText: { color: colors.white, fontSize: 12, fontWeight: "900" }, list: { padding: 15, gap: 10, flexGrow: 1 }, card: { padding: 14, gap: 12 }, cardTop: { flexDirection: "row", alignItems: "center", gap: 10 }, productCopy: { flex: 1 }, productName: { color: colors.dark, fontSize: 13, fontWeight: "800" }, meta: { marginTop: 4, color: colors.muted, fontSize: 10, lineHeight: 15 }, stock: { color: colors.green, fontSize: 12, fontWeight: "900" }, low: { color: colors.orange }, cardBottom: { paddingTop: 9, borderTopWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, actions: { flexDirection: "row", gap: 18 }, link: { color: colors.green, fontSize: 11, fontWeight: "900" }, remove: { color: colors.red, fontSize: 11, fontWeight: "800" }, empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }, emptyTitle: { color: colors.dark, fontSize: 16, fontWeight: "900", textAlign: "center" }, center: { flex: 1, justifyContent: "center", padding: 24, gap: 16 }, errorBox: { margin: 14, padding: 12, borderRadius: 10, backgroundColor: "#FFF0ED" }, error: { color: colors.red, fontSize: 11 }, shade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.35)" }, modal: { maxHeight: "82%", padding: 18, paddingBottom: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.white }, modalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { color: colors.dark, fontSize: 16, fontWeight: "900" }, close: { color: colors.muted, fontSize: 28 }, search: { height: 45, marginTop: 13, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 10, color: colors.dark }, choices: { maxHeight: 310, marginTop: 10 }, choice: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }, selectedName: { marginTop: 9, color: colors.dark, fontWeight: "800" }, inputLabel: { marginTop: 12, marginBottom: 6, color: colors.muted, fontSize: 10, fontWeight: "700" }, input: { height: 46, marginTop: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 10, color: colors.dark },
});
