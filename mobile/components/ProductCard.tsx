import { AgriText as Text } from "./AgriText";
import { Alert, Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { router } from "expo-router";
import { imageSource, money, type Offer, type Product } from "../src/api";
import { colors } from "../src/theme";
import { useAppStore } from "../src/store";

const categoryImages: Record<string, number> = {
  fertilizers: require("../assets/images/products/fertilizer-urea.webp"),
  seeds: require("../assets/images/products/seed-variety.webp"),
  pesticides: require("../assets/images/products/pesticide-hamla.webp"),
  equipment: require("../assets/images/products/pesticide-field.webp"),
};

export function productFallbackImage(categorySlug?: string): ImageSourcePropType {
  return categoryImages[categorySlug ?? ""] ?? categoryImages.equipment;
}

export function productImageSource(product: Product): ImageSourcePropType {
  return imageSource(product.imageUrl) ?? productFallbackImage(product.category.slug);
}

export function bestOffer(product: Product): Offer | undefined {
  return [...(product.offers ?? [])].sort((a, b) => {
    const aHasStock = a.availableStock > 0 ? 0 : 1;
    const bHasStock = b.availableStock > 0 ? 0 : 1;
    return aHasStock - bHasStock || Number(a.price) - Number(b.price);
  })[0];
}

export function ProductCard({ product, layout = "grid" }: { product: Product; layout?: "grid" | "carousel" }) {
  const { addToCart, savedProductIds, toggleSavedProduct } = useAppStore();
  const offer = bestOffer(product);
  const available = (offer?.availableStock ?? 0) >= (offer?.minimumOrderQuantity ?? 1);
  const source = productImageSource(product);
  const sample = product.id.startsWith("demo-product-");
  return <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })} style={({ pressed }) => [styles.card, layout === "carousel" && styles.carouselCard, pressed && styles.pressed]}>
    <View style={styles.imageWrap}><Image source={source} style={styles.image} resizeMode="contain"/><View style={[styles.badge, (!available || sample) && styles.badgeOut]}><Text style={[styles.badgeText, (!available || sample) && styles.badgeTextOut]}>{sample ? "Sample" : available ? "In stock" : "Out of stock"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={savedProductIds.includes(product.id) ? "Remove from saved products" : "Save product"} onPress={event => { event.stopPropagation(); toggleSavedProduct(product.id); }} style={styles.save}><Text style={[styles.saveText, savedProductIds.includes(product.id) && styles.saved]}>♥</Text></Pressable></View>
    <View style={styles.body}><Text style={styles.brand} numberOfLines={1}>{product.brand?.name ?? "Agri-One"} <Text style={styles.dot}>·</Text> {[product.packSize, product.unit].filter(Boolean).join(" ") || "Farm input"}</Text>{offer?.source && <Text style={styles.source}>{offer.source === "AGRI_ONE_STOCK" ? "Agri-One wholesale" : "Marketplace seller"}</Text>}<Text numberOfLines={2} style={styles.name}>{product.name}</Text>
      <View style={styles.priceRow}><Text style={styles.price}>{offer ? money(offer.price) : "Price on request"}</Text>{offer?.mrp && Number(offer.mrp) > Number(offer.price) && <Text style={styles.mrp}>{money(offer.mrp)}</Text>}</View>
      <Pressable disabled={!available} onPress={event => { event.stopPropagation(); if (offer) { addToCart(product, offer); if (sample) Alert.alert("Added to preview cart", "Sample listings are for browsing only. Connect the live catalogue to place a real order."); } }} style={({ pressed }) => [styles.add, !available && styles.addDisabled, pressed && available && styles.pressed]}><Text style={[styles.addText, !available && styles.addTextDisabled]}>{available ? sample ? "+  Add to preview cart" : "+  Add to cart" : "Unavailable"}</Text></Pressable>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { width: "48.4%", marginBottom: 12, overflow: "hidden", borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, shadowColor: "#173923", shadowOpacity: .045, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  carouselCard: { width: 236, marginBottom: 0 },
  pressed: { opacity: .85 }, imageWrap: { height: 150, padding: 10, backgroundColor: "#F3F7F1", alignItems: "center", justifyContent: "center" }, image: { width: "100%", height: "100%" }, save: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFFE8" }, saveText: { color: "#8D9A90", fontSize: 16 }, saved: { color: colors.red },
  badge: { position: "absolute", top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: "#E4F3E5" }, badgeOut: { backgroundColor: "#FCEBE8" }, badgeText: { color: colors.green, fontSize: 9, fontWeight: "800" }, badgeTextOut: { color: colors.red },
  body: { padding: 11 }, brand: { color: colors.muted, fontSize: 9, fontWeight: "600" }, dot: { color: colors.green }, source: { marginTop: 4, color: colors.green, fontSize: 8, fontWeight: "700" }, name: { minHeight: 39, marginTop: 6, color: colors.dark, fontSize: 13, lineHeight: 18, fontWeight: "700" }, priceRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7 }, price: { color: colors.dark, fontSize: 15, fontWeight: "800" }, mrp: { color: "#9AA39C", fontSize: 10, textDecorationLine: "line-through" }, add: { height: 38, marginTop: 10, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint }, addDisabled: { backgroundColor: "#F1F3F1" }, addText: { color: colors.green, fontSize: 11, fontWeight: "800" }, addTextDisabled: { color: "#89958D" },
});
