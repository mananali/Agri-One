import { AgriText as Text } from "../components/AgriText";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "../components/Brand";
import { Panel } from "../components/Controls";
import { apiRequest, type CatalogBrand } from "../src/api";
import { colors } from "../src/theme";

const demoBrands = ["IFFCO", "Mahyco", "T. Stanes", "Multiplex", "Coromandel", "Jain Irrigation", "Yara", "Gharda"];
export default function BrandsScreen() {
  const [brands, setBrands] = useState<CatalogBrand[] | null>(null);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => { let active = true; const load = () => { void apiRequest<CatalogBrand[]>("/catalog/brands").then(items => { if (active) setBrands(items); }).catch(() => undefined).finally(() => { if (active) setLoading(false); }); }; load(); const timer = setInterval(load, 30_000); return () => { active = false; clearInterval(timer); }; }, []));
  const list = brands === null ? demoBrands.map((name, i) => ({ id: `demo-${i}`, name, slug: name.toLowerCase().replaceAll(" ", "-") })) : brands;
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}><Brand/><Text style={styles.title}>Brands for your business</Text><Text style={styles.subtitle}>Discover familiar agriculture brands in one place.</Text>{loading && <ActivityIndicator color={colors.green} style={{ marginTop: 20 }}/>}<View style={styles.list}>{list.map((item, index) => <Pressable key={item.id} onPress={() => router.push({ pathname: "/(tabs)", params: { search: item.name } })}><Panel style={styles.brandCard}><View style={[styles.mark, { backgroundColor: ["#E8F3E9", "#F2F0E2", "#F8EDE6"][index % 3] }]}><Text style={styles.letter}>{item.name.slice(0, 1)}</Text></View><View style={styles.brandText}><Text style={styles.brandName}>{item.name}</Text><Text style={styles.brandHint}>View available products</Text></View><Text style={styles.arrow}>›</Text></Panel></Pressable>)}</View><Text style={styles.note}>Sample brand list is shown when the live catalogue is offline.</Text></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 30 }, title: { marginTop: 27, color: colors.dark, fontSize: 25, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 13 }, list: { gap: 9, marginTop: 20 }, brandCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }, mark: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" }, letter: { color: colors.green, fontWeight: "900", fontSize: 19 }, brandText: { flex: 1 }, brandName: { color: colors.dark, fontSize: 13, fontWeight: "800" }, brandHint: { marginTop: 3, color: colors.muted, fontSize: 10 }, arrow: { color: colors.green, fontSize: 23 }, note: { marginTop: 17, color: colors.muted, fontSize: 10, lineHeight: 16 } });
