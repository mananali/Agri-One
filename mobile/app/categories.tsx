import { AgriText as Text } from "../components/AgriText";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "../components/Brand";
import { Panel } from "../components/Controls";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

const tones = ["#E7F3E8", "#EFF4DA", "#FCEDE6", "#EAF1F8", "#F2ECF8", "#E8F2EF"];
const glyphs = ["✳", "❋", "◉", "⚙", "❧", "⌕"];

export default function CategoriesScreen() {
  const { categories, products } = useAppStore();
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}>
    <Brand/><Text style={styles.title}>Shop by category</Text><Text style={styles.subtitle}>Find the right products for your store.</Text>
    <View style={styles.grid}>{categories.filter(item => item.slug).map((item, index) => <Pressable key={item.id} onPress={() => router.push({ pathname: "/(tabs)", params: { category: item.slug } })} style={({ pressed }) => [styles.card, pressed && { opacity: .8 }]}><Panel style={{ ...styles.panel, backgroundColor: tones[index % tones.length] }}><Text style={styles.glyph}>{glyphs[index % glyphs.length]}</Text><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{products.filter(p => p.category.slug === item.slug).length} products</Text></Panel></Pressable>)}</View>
    <Text style={styles.section}>Explore Agri-One</Text>
    {[{ title: "Popular brands", path: "/brands" }, { title: "Our services", path: "/info/services" }, { title: "About Agri-One", path: "/info/about" }].map(item => <Pressable key={item.path} onPress={() => router.push(item.path as never)}><Panel style={styles.link}><Text style={styles.linkTitle}>{item.title}</Text><Text style={styles.arrow}>›</Text></Panel></Pressable>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 32 }, title: { marginTop: 28, color: colors.dark, fontSize: 25, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 13 }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 20 }, card: { width: "48.5%", marginBottom: 10 }, panel: { minHeight: 126, justifyContent: "center", borderWidth: 0 }, glyph: { color: colors.green, fontSize: 24 }, name: { marginTop: 8, color: colors.dark, fontSize: 14, fontWeight: "800" }, meta: { marginTop: 3, color: colors.muted, fontSize: 10 }, section: { marginTop: 18, marginBottom: 10, color: colors.dark, fontWeight: "900", fontSize: 17 }, link: { marginBottom: 9, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, linkTitle: { color: colors.dark, fontWeight: "700", fontSize: 13 }, arrow: { color: colors.green, fontSize: 23 } });
