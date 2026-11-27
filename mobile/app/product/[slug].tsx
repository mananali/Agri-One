import { AgriText as Text } from "../../components/AgriText";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Panel } from "../../components/Controls";
import { bestOffer, productImageSource } from "../../components/ProductCard";
import { apiRequest, money, type Product } from "../../src/api";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { products, loadingCatalog, addToCart, recordRecentlyViewed } = useAppStore();
  const [product, setProduct] = useState<Product | null>(products.find(item => item.slug === slug) ?? null);
  const [loading, setLoading] = useState(!product);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = products.find(item => item.slug === slug);
    if (cached) { setProduct(cached); setLoading(false); return; }
    let active = true;
    setProduct(null); setLoading(true); setError("");
    apiRequest<Product>(`/catalog/products/${encodeURIComponent(slug)}`).then(result => {
      if (active) setProduct(result);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load this product.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, products]);

  useEffect(() => { if (product) recordRecentlyViewed(product.id); }, [product?.id, recordRecentlyViewed]);

  if (loading || (loadingCatalog && !product)) return <SafeAreaView style={styles.safe}><ActivityIndicator style={styles.spinner} color={colors.green}/></SafeAreaView>;
  if (!product) return <SafeAreaView style={styles.safe} edges={["top"]}><EmptyState title="Product unavailable" detail={error || "This product may have been removed from the catalogue."} action={<Button title="Back to shop" onPress={() => router.replace("/(tabs)")}/>} /></SafeAreaView>;

  const offer = bestOffer(product);
  const available = (offer?.availableStock ?? 0) >= (offer?.minimumOrderQuantity ?? 1);
  const pack = [product.packSize, product.unit].filter(Boolean).join(" ");
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}>
    <Button title="‹  Back to shop" variant="plain" onPress={() => router.back()} style={styles.back}/>
    <View style={styles.imageWrap}><Image source={productImageSource(product)} style={styles.image} resizeMode="contain"/></View>
    <Text style={styles.brand}>{product.brand?.name ?? "Agri-One"}{pack ? `  ·  ${pack}` : ""}</Text>
    <Text style={styles.name}>{product.name}</Text>
    <View style={styles.priceRow}><Text style={styles.price}>{offer ? money(offer.price) : "Price on request"}</Text>{offer?.mrp && Number(offer.mrp) > Number(offer.price) && <Text style={styles.mrp}>{money(offer.mrp)}</Text>}</View>
    <Text style={[styles.stock, available && styles.stockAvailable]}>{available ? `${offer?.availableStock} available` : offer && offer.availableStock > 0 ? `Minimum order is ${offer.minimumOrderQuantity}; currently only ${offer.availableStock} available` : "Currently unavailable"}</Text>
    <Panel style={styles.details}><Text style={styles.sectionTitle}>Product details</Text><Text style={styles.description}>{product.description || "Trusted agriculture input for your business."}</Text>{pack ? <View style={styles.detailRow}><Text style={styles.detailLabel}>Pack size</Text><Text style={styles.detailValue}>{pack}</Text></View> : null}<View style={styles.detailRow}><Text style={styles.detailLabel}>Category</Text><Text style={styles.detailValue}>{product.category.name}</Text></View>{offer?.source ? <View style={styles.detailRow}><Text style={styles.detailLabel}>Supply source</Text><Text style={styles.detailValue}>{offer.source === "AGRI_ONE_STOCK" ? "Agri-One wholesale" : "Marketplace seller"}</Text></View> : null}{offer?.seller?.name ? <View style={styles.detailRow}><Text style={styles.detailLabel}>Sold by</Text><Text style={styles.detailValue}>{offer.seller.name}</Text></View> : null}{offer ? <View style={styles.detailRow}><Text style={styles.detailLabel}>Minimum order</Text><Text style={styles.detailValue}>{offer.minimumOrderQuantity}</Text></View> : null}</Panel>
    <Button title={available ? "Add to cart" : "Unavailable"} disabled={!available} onPress={() => { if (offer) { addToCart(product, offer); router.push("/(tabs)/cart"); } }}/>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 30 }, back: { alignSelf: "flex-start", marginBottom: 8 }, imageWrap: { height: 290, borderRadius: 18, backgroundColor: "#F0F5EF", alignItems: "center", justifyContent: "center" }, image: { width: "82%", height: "82%" }, brand: { marginTop: 19, color: colors.muted, fontSize: 11, fontWeight: "700" }, name: { marginTop: 6, color: colors.dark, fontSize: 23, lineHeight: 30, fontWeight: "900" }, priceRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 9 }, price: { color: colors.dark, fontSize: 21, fontWeight: "900" }, mrp: { color: colors.muted, fontSize: 12, textDecorationLine: "line-through" }, stock: { marginTop: 7, color: colors.red, fontSize: 11, fontWeight: "700" }, stockAvailable: { color: colors.green }, details: { marginTop: 18, marginBottom: 17, gap: 12 }, sectionTitle: { color: colors.dark, fontSize: 14, fontWeight: "800" }, description: { color: colors.muted, fontSize: 12, lineHeight: 19 }, detailRow: { paddingTop: 10, borderTopWidth: 1, borderColor: colors.line, flexDirection: "row", justifyContent: "space-between", gap: 12 }, detailLabel: { color: colors.muted, fontSize: 11 }, detailValue: { flexShrink: 1, color: colors.dark, fontSize: 11, fontWeight: "700", textAlign: "right" }, spinner: { marginTop: 50 } });
