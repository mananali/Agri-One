import { AgriText as Text } from "../components/AgriText";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState } from "../components/Controls";
import { ProductCard } from "../components/ProductCard";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

export default function WishlistScreen() {
  const { products, savedProductIds } = useAppStore();
  const saved = products.filter(product => savedProductIds.includes(product.id));
  return <SafeAreaView style={styles.safe} edges={["top"]}><FlatList data={saved} keyExtractor={item => item.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.list} ListHeaderComponent={<View style={styles.header}><Text style={styles.title}>Saved products</Text><Text style={styles.hint}>Keep products you want to find again.</Text></View>} renderItem={({ item }) => <ProductCard product={item}/>} ListEmptyComponent={<EmptyState title="Nothing saved yet" detail="Tap the heart on a product to save it here." action={<Button title="Explore products" onPress={() => router.replace("/(tabs)")}/>}/>} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, list: { paddingBottom: 24 }, header: { padding: 18 }, title: { color: colors.dark, fontSize: 25, fontWeight: "900" }, hint: { marginTop: 4, color: colors.muted, fontSize: 12 }, row: { justifyContent: "space-between", paddingHorizontal: 17 } });
