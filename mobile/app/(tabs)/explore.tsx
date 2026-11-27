import { AgriText as Text, AgriTextInput as TextInput } from "../../components/AgriText";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Brand } from "../../components/Brand";
import { ProductCard } from "../../components/ProductCard";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

export default function ProductsScreen() {
  const { categories, products, cart } = useAppStore();
  const params = useLocalSearchParams<{ category?: string }>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(typeof params.category === "string" ? params.category : "");
  useEffect(() => { if (typeof params.category === "string") setSelectedCategory(params.category); }, [params.category]);
  const visible = useMemo(() => products.filter(product =>
    (!selectedCategory || product.category.slug === selectedCategory) &&
    `${product.name} ${product.brand?.name ?? ""} ${product.category.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [products, selectedCategory, search]);
  const header = <View>
    <View style={styles.brandRow}><Brand/><Pressable accessibilityRole="button" accessibilityLabel={`Open cart, ${cart.length} items`} onPress={() => router.push("/(tabs)/cart")} style={styles.cart}><Text style={styles.cartText}>Cart · {cart.reduce((sum, line) => sum + line.quantity, 0)}</Text></Pressable></View>
    <Text style={styles.title}>Products</Text><Text style={styles.subtitle}>Find wholesale agri-inputs for your shop.</Text>
    <TextInput value={search} onChangeText={setSearch} placeholder="Search product, brand or category" returnKeyType="search" style={styles.search}/>
    <View style={styles.chips}><Pressable onPress={() => setSelectedCategory("")} style={[styles.chip, !selectedCategory && styles.chipSelected]}><Text style={[styles.chipText, !selectedCategory && styles.chipTextSelected]}>All</Text></Pressable>{categories.filter(item => item.slug).map(category => <Pressable key={category.id} onPress={() => setSelectedCategory(category.slug)} style={[styles.chip, selectedCategory === category.slug && styles.chipSelected]}><Text style={[styles.chipText, selectedCategory === category.slug && styles.chipTextSelected]}>{category.name}</Text></Pressable>)}</View>
    <View style={styles.resultRow}><Text style={styles.result}>{visible.length} products</Text><Pressable onPress={() => router.push("/brands")}><Text style={styles.brands}>Browse brands ›</Text></Pressable></View>
  </View>;
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <FlatList data={visible} keyExtractor={item => item.id} numColumns={2} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.list} ListHeaderComponent={header} renderItem={({ item }) => <ProductCard product={item}/>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No matching products</Text><Text style={styles.subtitle}>Try a different search or category.</Text></View>} showsVerticalScrollIndicator={false}/>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, list: { paddingBottom: 22 }, brandRow: { minHeight: 55, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17 }, cart: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.greenTint }, cartText: { color: colors.green, fontSize: 10, fontWeight: "900" }, title: { marginTop: 14, paddingHorizontal: 18, color: colors.dark, fontSize: 25, fontWeight: "900" }, subtitle: { marginTop: 5, paddingHorizontal: 18, color: colors.muted, fontSize: 12 }, search: { height: 47, marginHorizontal: 17, marginTop: 16, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, color: colors.dark }, chips: { paddingHorizontal: 17, paddingTop: 13, paddingBottom: 3, flexDirection: "row", gap: 7 }, chip: { paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.white }, chipSelected: { borderColor: colors.green, backgroundColor: colors.green }, chipText: { color: colors.muted, fontSize: 10, fontWeight: "700" }, chipTextSelected: { color: colors.white }, resultRow: { marginHorizontal: 17, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between" }, result: { color: colors.muted, fontSize: 10, fontWeight: "700" }, brands: { color: colors.green, fontSize: 10, fontWeight: "900" }, productRow: { justifyContent: "space-between", paddingHorizontal: 17 }, empty: { padding: 30, alignItems: "center" }, emptyTitle: { color: colors.dark, fontSize: 16, fontWeight: "800" },
});
