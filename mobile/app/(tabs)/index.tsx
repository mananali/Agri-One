import { AgriText as Text, AgriTextInput as TextInput } from "../../components/AgriText";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { bestOffer, productImageSource, ProductCard } from "../../components/ProductCard";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";
import { apiRequest, money, type MobileHomeTopSelling, type Order, type Product } from "../../src/api";

const homeCategories = [
  { slug: "seeds", name: "Seeds", translation: "\u09ac\u09c0\u099c", image: require("../../assets/images/products/seed-variety.webp") },
  { slug: "fertilizers", name: "Fertilizers", translation: "\u09b8\u09be\u09b0", image: require("../../assets/images/products/fertilizer-urea.webp") },
  { slug: "pesticides", name: "Pesticides", translation: "\u0995\u09c0\u099f\u09a8\u09be\u09b6\u0995", image: require("../../assets/images/products/pesticide-hamla.webp") },
  { slug: "crop-nutrition", name: "Crop Nutrition", translation: "\u09aa\u09c1\u09b7\u09cd\u099f\u09bf", image: null },
  { slug: "equipment", name: "Agro Tools", translation: "\u0995\u09c3\u09b7\u09bf \u09af\u09a8\u09cd\u09a4\u09cd\u09b0\u09aa\u09be\u09a4\u09bf", image: null },
  { slug: "more", name: "More", translation: "\u0985\u09a8\u09cd\u09af\u09be\u09a8\u09cd\u09af", image: null, more: true },
];

function RecentProductCard({ product }: { product: Product }) {
  const offer = bestOffer(product);
  return <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })} style={({ pressed }) => [styles.recentCard, pressed && styles.pressed]}>
    <View style={styles.recentImageWrap}><Image source={productImageSource(product)} style={styles.recentImage} resizeMode="contain" /></View>
    <View style={styles.recentCardBody}>
      <Text numberOfLines={2} style={styles.recentProductName}>{product.name}</Text>
      <Text numberOfLines={1} style={styles.recentProductPack}>{[product.packSize, product.unit].filter(Boolean).join(" ") || product.category.name}</Text>
      <Text style={styles.recentProductPrice}>{offer ? money(offer.price) : "Ask for price"}</Text>
    </View>
  </Pressable>;
}

function RecentProductSection({ title, products, emptyMessage, onSeeAll }: { title: string; products: Product[]; emptyMessage: string; onSeeAll?: () => void }) {
  return <View style={styles.recentSection}>
    <View style={styles.recentHeading}><Text style={styles.recentTitle}>{title}</Text>{onSeeAll && <Pressable onPress={onSeeAll}><Text style={styles.recentSeeAll}>SEE ALL</Text></Pressable>}</View>
    {products.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>{products.map(product => <RecentProductCard key={product.id} product={product} />)}</ScrollView> : <View style={styles.recentEmpty}><Text style={styles.recentEmptyText}>{emptyMessage}</Text></View>}
  </View>;
}

function TopSellingSection({ section }: { section: MobileHomeTopSelling | null }) {
  if (!section?.enabled) return null;
  return <View style={styles.topSellingSection}>
    <View style={styles.topSellingHeading}><View style={styles.topSellingHeadingCopy}><Text style={styles.topSellingTitle}>{section.title}</Text><Text style={styles.topSellingSubtitle}>{section.subtitle}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/explore")}><Text style={styles.topSellingSeeAll}>SEE ALL</Text></Pressable></View>
    {section.products.length ? <View style={styles.topSellingGrid}>{section.products.slice(0, 9).map((product, index) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`${index + 1}. ${product.name}`} onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })} style={({ pressed }) => [styles.topSellingTile, pressed && styles.pressed]}><View style={styles.topSellingProductCard}><Text style={styles.topSellingRank}>{index + 1}</Text><Image source={productImageSource(product)} style={styles.topSellingImage} resizeMode="contain" /><Text numberOfLines={2} style={styles.topSellingProductName}>{product.name}</Text></View></Pressable>)}</View> : <View style={styles.topSellingEmpty}><Text style={styles.topSellingEmptyText}>Products selected by Agri-One will appear here.</Text></View>}
  </View>;
}

export default function ShopScreen() {
  const { products, categories, promotions, notifications, markNotificationRead, loadingCatalog, catalogError, loadCatalog, token, organization, recentlyViewedIds } = useAppStore();
  const params = useLocalSearchParams<{ search?: string; category?: string }>();
  const [search, setSearch] = useState(typeof params.search === "string" ? params.search : "");
  const [selectedCategory, setSelectedCategory] = useState(typeof params.category === "string" ? params.category : "");
  const [recentlyBoughtIds, setRecentlyBoughtIds] = useState<string[]>([]);
  const [topSelling, setTopSelling] = useState<MobileHomeTopSelling | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(item => !item.readAt).length;
  useEffect(() => { if (typeof params.search === "string") setSearch(params.search); }, [params.search]);
  useEffect(() => { if (typeof params.category === "string") setSelectedCategory(params.category); }, [params.category]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refreshTopSelling = () => { void apiRequest<MobileHomeTopSelling>("/catalog/mobile-home/top-selling").then(section => { if (active) setTopSelling(section); }).catch(() => undefined); };
    refreshTopSelling();
    const timer = setInterval(refreshTopSelling, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, []));

  useFocusEffect(useCallback(() => {
    if (!token) { setRecentlyBoughtIds([]); return; }
    let active = true;
    apiRequest<Order[]>("/orders", token).then(orders => {
      const offerIds = orders.filter(order => !["CANCELLED", "REJECTED"].includes(order.status)).flatMap(order => order.fulfillments ?? []).flatMap(fulfillment => fulfillment.lines).map(line => line.offerId);
      const bought = Array.from(new Set(offerIds)).map(offerId => products.find(product => product.offers.some(offer => offer.id === offerId))).filter((product): product is Product => Boolean(product)).map(product => product.id);
      if (active) setRecentlyBoughtIds(bought);
    }).catch(() => { if (active) setRecentlyBoughtIds([]); });
    return () => { active = false; };
  }, [token, products]));

  const recentlyViewed = useMemo(() => recentlyViewedIds.map(id => products.find(product => product.id === id)).filter((product): product is Product => Boolean(product)), [products, recentlyViewedIds]);
  const recentlyBought = useMemo(() => recentlyBoughtIds.map(id => products.find(product => product.id === id)).filter((product): product is Product => Boolean(product)), [products, recentlyBoughtIds]);
  const filteredProducts = useMemo(() => products.filter(product => (!selectedCategory || product.category.slug === selectedCategory) && `${product.name} ${product.brand?.name ?? ""} ${product.category.name}`.toLowerCase().includes(search.trim().toLowerCase())), [products, selectedCategory, search]);
  const visibleDeals = useMemo(() => [...filteredProducts].sort((a, b) => {
    const aDiscount = bestOffer(a)?.mrp ? Number(bestOffer(a)?.mrp) - Number(bestOffer(a)?.price) : 0;
    const bDiscount = bestOffer(b)?.mrp ? Number(bestOffer(b)?.mrp) - Number(bestOffer(b)?.price) : 0;
    return bDiscount - aDiscount;
  }), [filteredProducts]);
  const categorySlugFor = (slug: string) => {
    const patterns: Record<string, RegExp> = { seeds: /seed/i, fertilizers: /fertiliz|manure/i, pesticides: /pesticid|insecticid|fungicid/i, "crop-nutrition": /nutrition|fertiliz|organic|bio/i, equipment: /equipment|tool|implement/i };
    const pattern = patterns[slug];
    return categories.find(category => pattern?.test(`${category.slug} ${category.name}`))?.slug ?? slug;
  };
  const openHomeCategory = (tile: typeof homeCategories[number]) => {
    if (tile.more) { router.push("/categories"); return; }
    const category = categorySlugFor(tile.slug);
    setSelectedCategory(category);
    router.push({ pathname: "/(tabs)/explore", params: { category } });
  };

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <StatusBar style="light" />
    <View style={styles.fixedHomeHeader}>
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <Image accessible accessibilityLabel="Agri-One logo" source={require("../../assets/images/agri-one-logo-transparent.png")} resizeMode="contain" style={styles.headerLogo} />
            <View style={styles.brandCopy}>
              <View style={styles.brandNamePlate}>
                <Text variant="brand" accessibilityLabel="Agri-One" style={styles.brandName}><Text variant="brand" style={styles.brandNameAgri}>Agri-</Text><Text variant="brand" style={styles.brandNameOneO}>O</Text><Text variant="brand" style={styles.brandNameOneN}>n</Text><Text variant="brand" style={styles.brandNameOneE}>e</Text></Text>
              </View>
              <Text style={styles.brandSubtitle}>Retailer Wholesale App</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={"Notifications, " + unreadCount + " unread"} onPress={() => setShowNotifications(value => !value)} style={styles.notificationButton}><SymbolView name={{ ios: "bell.fill", android: "notifications", web: "notifications" }} size={27} tintColor="#FFFFFF" />{unreadCount > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View>}</Pressable>
            <View style={styles.headerDivider} />
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push("/(tabs)/account")} style={styles.profileButton}><SymbolView name={{ ios: "person.crop.circle.fill", android: "account_circle", web: "account_circle" }} size={38} tintColor="#FFFFFF" /></Pressable>
          </View>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}><SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={23} tintColor="#1F2922" /><TextInput placeholder="Search product, brand or code..." placeholderTextColor="#737A75" value={search} onChangeText={setSearch} style={styles.searchInput} returnKeyType="search" />{!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")}><Text style={styles.clearSearch}>x</Text></Pressable>}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Browse and filter products" onPress={() => router.push({ pathname: "/(tabs)/explore", params: { search } })} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}><SymbolView name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }} size={25} tintColor="#15552D" /></Pressable>
        </View>
      </View>
    </View>
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loadingCatalog} onRefresh={loadCatalog} tintColor={colors.green} />} contentContainerStyle={styles.page}>
      <View style={styles.categoryGrid}>{homeCategories.map(tile => {
        const active = selectedCategory === categorySlugFor(tile.slug);
        return <Pressable key={tile.slug} accessibilityRole="button" accessibilityLabel={"Shop " + tile.name} onPress={() => openHomeCategory(tile)} style={({ pressed }) => [styles.categoryCard, active && styles.categoryCardActive, pressed && styles.pressed]}>
          <View style={styles.categoryImage}>{tile.image ? <Image source={tile.image} style={styles.categoryPhotoImage} resizeMode="contain" /> : tile.more ? <View style={styles.moreIconCircle}><SymbolView name={{ ios: "square.grid.2x2.fill", android: "apps", web: "apps" }} size={31} tintColor="#FFFFFF" /></View> : tile.slug === "equipment" ? <SymbolView name={{ ios: "wrench.and.screwdriver.fill", android: "handyman", web: "handyman" }} size={55} tintColor="#3F6945" /> : <SymbolView name={{ ios: "leaf.fill", android: "eco", web: "eco" }} size={55} tintColor="#48A82F" />}</View>
          <Text numberOfLines={1} style={styles.categoryName}>{tile.name}</Text><Text numberOfLines={1} style={styles.categoryTranslation}>({tile.translation})</Text>
        </Pressable>;
      })}</View>
      {showNotifications && notifications.filter(item => !item.readAt).slice(0, 3).map(item => <Pressable key={item.id} onPress={() => void markNotificationRead(item.notification.id)} style={styles.notificationCard}><Text style={styles.notificationTitle}>{item.notification.title}</Text><Text style={styles.notificationBody}>{item.notification.body}</Text></Pressable>)}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Special deals</Text><Pressable onPress={() => router.push("/(tabs)/explore")}><Text style={styles.seeAll}>SEE ALL</Text></Pressable></View>
      {loadingCatalog && products.length === 0 ? <ActivityIndicator style={styles.loader} color={colors.green} /> : visibleDeals.length ? <View>{Array.from({ length: Math.ceil(visibleDeals.length / 3) }, (_, rowIndex) => <View key={`deal-row-${rowIndex}`} style={styles.productRowBlock}>
        {rowIndex > 0 && <Text style={styles.moreProductsLabel}>More products</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productCarousel}>{visibleDeals.slice(rowIndex * 3, rowIndex * 3 + 3).map(product => <ProductCard key={product.id} product={product} layout="carousel" />)}</ScrollView>
      </View>)}</View> : <View style={styles.empty}><Text style={styles.emptyTitle}>No products found</Text><Text style={styles.emptyCopy}>Try another search or category.</Text></View>}
      {!!catalogError && <Text style={styles.catalogNote}>Showing sample listings while the live catalogue is unavailable.</Text>}
      <View style={styles.promoWrap}><View style={styles.promoCard}><View style={styles.promoGlow} /><View style={styles.promoCopy}><Text style={styles.promoKicker}>GROW WITH CONFIDENCE</Text><Text style={styles.promoTitle}>The right nutrition for every season.</Text><Text style={styles.promoCaption}>Explore trusted crop nutrition</Text><Pressable onPress={() => setSelectedCategory(categories.find(category => category.slug === "fertilizers")?.slug ?? "")} style={styles.promoButton}><Text style={styles.promoButtonText}>SHOP FERTILIZERS</Text></Pressable></View><Image source={require("../../assets/images/products/fertilizer-urea.webp")} style={styles.promoProduct} resizeMode="contain" /><SymbolView name={{ ios: "leaf.fill", android: "eco", web: "eco" }} size={21} tintColor="#C7E550" style={styles.promoLeaf} /></View></View>
      {promotions.map(promotion => <Pressable key={promotion.id} onPress={() => router.push("/schemes")} style={styles.promotionCard}><Text style={styles.promotionTitle}>{promotion.title}</Text><Text style={styles.promotionBody}>{promotion.body}</Text><Text style={styles.promotionDate}>Offer valid until {new Date(promotion.endsAt).toLocaleDateString("en-IN")}</Text></Pressable>)}
      <RecentProductSection title="Recently Viewed" products={recentlyViewed} emptyMessage="Products you view will appear here." />
      <RecentProductSection title="Recently Bought" products={recentlyBought} emptyMessage={token ? "Your previous purchases will appear here." : "Sign in to see your previous purchases."} onSeeAll={() => router.push("/(tabs)/orders")} />
      <TopSellingSection section={topSelling} />
      <Pressable onPress={() => router.push("/(tabs)/explore")} style={styles.recommendation}><View><Text style={styles.recommendationTitle}>Find products for your store</Text><Text style={styles.recommendationCopy}>Browse seeds, crop care, and more.</Text></View><Text style={styles.recommendationArrow}>›</Text></Pressable>
      <View style={styles.footerBrand}><Text style={styles.footerBrandText}>Agri-One · Smart Farming Solutions</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" }, fixedHomeHeader: { zIndex: 2, backgroundColor: "#206438", shadowColor: "#123C20", shadowOpacity: .15, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 }, scroll: { flex: 1, backgroundColor: "#FFFFFF" }, page: { paddingBottom: 16, backgroundColor: "#FFFFFF" },
  hero: { paddingHorizontal: 18, paddingTop: 1, paddingBottom: 4, backgroundColor: "#206438" }, brandRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brandLockup: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 }, headerLogo: { width: 52, height: 44 }, brandCopy: { minWidth: 0, flexShrink: 1, gap: 2 }, brandNamePlate: { alignSelf: "flex-start" }, brandName: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -.35 }, brandNameAgri: { color: "#FFFFFF" }, brandNameOneO: { color: "#F5A13A" }, brandNameOneN: { color: "#F27B27" }, brandNameOneE: { color: "#E85D21" }, brandSubtitle: { flexShrink: 1, color: "#FFFFFF", fontSize: 9, fontStyle: "italic", fontWeight: "800", lineHeight: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 }, notificationButton: { width: 34, height: 38, alignItems: "center", justifyContent: "center", position: "relative" }, notificationBadge: { position: "absolute", right: -1, top: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#E83E4C" }, notificationBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" }, headerDivider: { width: 1, height: 31, backgroundColor: "#A7C8A5", opacity: .55 }, profileButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 7 }, searchBox: { flex: 1, height: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: "#FFFFFF" }, searchInput: { flex: 1, paddingVertical: 0, color: "#303631", fontSize: 15, backgroundColor: "transparent", borderWidth: 0, borderColor: "transparent", outlineWidth: 0 }, clearSearch: { paddingHorizontal: 3, color: colors.muted, fontSize: 22 }, filterButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#E5F7C8" }, pressed: { opacity: .82 },
  notificationCard: { marginHorizontal: 16, marginTop: 8, padding: 13, borderWidth: 1, borderColor: colors.green, borderRadius: 12, backgroundColor: "#FFFFFF" }, notificationTitle: { color: colors.dark, fontSize: 13, fontWeight: "800" }, notificationBody: { marginTop: 4, color: colors.muted, fontSize: 11 },
  categoryGrid: { marginTop: 17, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, backgroundColor: "#F2F7F1" }, categoryCard: { width: "32%", height: 108, paddingHorizontal: 5, paddingTop: 5, paddingBottom: 6, alignItems: "center", justifyContent: "flex-end", borderRadius: 17, borderWidth: 1, borderColor: "#E5EEE5", backgroundColor: "#FFFFFF", shadowColor: "#0B3D1E", shadowOpacity: .14, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }, categoryCardActive: { borderColor: "#B7DAA9", backgroundColor: "#F4FAF1" }, categoryImage: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }, categoryPhotoImage: { width: "92%", height: "94%" }, moreIconCircle: { width: 55, height: 55, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: "#20B72D" }, categoryName: { maxWidth: "100%", color: "#15552D", fontSize: 12, lineHeight: 15, fontWeight: "900", textAlign: "center" }, categoryTranslation: { maxWidth: "100%", color: "#545B55", fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center" },
  promoWrap: { marginHorizontal: 16, marginTop: 16 }, promotionCard: { marginHorizontal: 16, marginTop: 10, padding: 15, borderRadius: 14, backgroundColor: colors.green }, promotionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, promotionBody: { marginTop: 4, color: "#EFF9F0", fontSize: 12 }, promotionDate: { marginTop: 6, color: "#D9F0DC", fontSize: 10 },
  recentSection: { marginTop: 18 }, recentHeading: { marginBottom: 10, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, recentTitle: { color: "#171B19", fontSize: 20, fontWeight: "900", letterSpacing: -.4 }, recentSeeAll: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: .6 }, recentRow: { paddingHorizontal: 16, paddingBottom: 5, gap: 11 }, recentCard: { width: 174, overflow: "hidden", borderWidth: 1, borderColor: "#E4EAE5", borderRadius: 15, backgroundColor: colors.white }, recentImageWrap: { height: 112, padding: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F8F4" }, recentImage: { width: "100%", height: "100%" }, recentCardBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 }, recentProductName: { minHeight: 34, color: "#181D1A", fontSize: 12, lineHeight: 16, fontWeight: "800", textTransform: "uppercase" }, recentProductPack: { marginTop: 5, color: "#7D877F", fontSize: 9 }, recentProductPrice: { marginTop: 7, color: "#111714", fontSize: 16, fontWeight: "900" }, recentEmpty: { marginHorizontal: 16, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: "#E7ECE8", backgroundColor: colors.white }, recentEmptyText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  topSellingSection: { marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 19, backgroundColor: "#006341", borderWidth: 1, borderColor: "#11835B" }, topSellingHeading: { marginBottom: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, topSellingHeadingCopy: { flex: 1 }, topSellingTitle: { color: colors.white, fontSize: 20, fontWeight: "900", letterSpacing: -.35 }, topSellingSubtitle: { marginTop: 4, color: "#D5EEE2", fontSize: 11, fontWeight: "600" }, topSellingSeeAll: { paddingHorizontal: 5, color: "#E3CF4C", fontSize: 11, fontWeight: "900", letterSpacing: .5 }, topSellingGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9 }, topSellingTile: { width: "31.8%", aspectRatio: 1, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: "#27856A", backgroundColor: "#07583F" }, topSellingProductCard: { flex: 1, position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 5, paddingBottom: 7, borderRadius: 11, backgroundColor: "#FFFFFF" }, topSellingRank: { position: "absolute", zIndex: 1, left: 4, top: -11, color: "#E0F2E9", fontSize: 59, lineHeight: 68, fontWeight: "900" }, topSellingImage: { width: "82%", height: "62%", marginTop: 7, zIndex: 2 }, topSellingProductName: { width: "100%", minHeight: 31, marginTop: 3, color: "#17211B", fontSize: 10, lineHeight: 13, fontWeight: "900", textAlign: "center" }, topSellingEmpty: { padding: 13, borderRadius: 12, backgroundColor: "#07583F" }, topSellingEmptyText: { color: "#D5EEE2", fontSize: 11, textAlign: "center" },
  promoCard: { height: 148, overflow: "hidden", flexDirection: "row", alignItems: "center", borderRadius: 17, backgroundColor: "#146A20", borderWidth: 1, borderColor: "#4FA52D" }, promoCardSecond: { marginTop: 10, backgroundColor: "#075B43", borderColor: "#168263" }, promoGlow: { position: "absolute", width: 260, height: 260, left: -120, top: -150, borderRadius: 140, backgroundColor: "#339F20", opacity: .8 }, promoCopy: { zIndex: 2, width: "63%", paddingLeft: 15, paddingVertical: 10 }, promoKicker: { color: "#F6DC38", fontSize: 8, fontWeight: "900", letterSpacing: .7 }, promoTitle: { marginTop: 5, color: colors.white, fontSize: 16, lineHeight: 19, fontWeight: "900" }, promoCaption: { marginTop: 4, color: "#E5F4DC", fontSize: 9, fontWeight: "700" }, promoButton: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: "#F3D927" }, promoButtonText: { color: "#16431A", fontSize: 8, fontWeight: "900", letterSpacing: .25 }, promoProduct: { position: "absolute", right: 3, bottom: 1, width: "40%", height: "90%", borderRadius: 10 }, promoLeaf: { position: "absolute", top: 9, right: 12, color: "#C7E550", fontSize: 21 },
  sectionHeader: { marginTop: 16, marginBottom: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: "#171B19", fontSize: 19, fontWeight: "900", letterSpacing: -.3, textTransform: "capitalize" }, seeAll: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: .6 }, productRowBlock: { marginBottom: 13 }, moreProductsLabel: { marginBottom: 8, paddingHorizontal: 16, color: "#68746C", fontSize: 13, fontWeight: "800" }, productCarousel: { paddingHorizontal: 16, paddingBottom: 5, gap: 12 },
  loader: { marginVertical: 35 }, empty: { marginHorizontal: 17, padding: 20, borderRadius: 14, backgroundColor: colors.white }, emptyTitle: { color: colors.dark, fontSize: 14, fontWeight: "800" }, emptyCopy: { marginTop: 4, color: colors.muted, fontSize: 11 }, catalogNote: { marginHorizontal: 17, marginTop: 8, color: colors.muted, fontSize: 10 }, recommendation: { minHeight: 75, marginHorizontal: 16, marginTop: 17, paddingHorizontal: 15, borderRadius: 14, backgroundColor: "#E9F8EF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, recommendationTitle: { color: colors.dark, fontSize: 14, fontWeight: "900" }, recommendationCopy: { marginTop: 4, color: colors.muted, fontSize: 10 }, recommendationArrow: { color: colors.green, fontSize: 30 }, footerBrand: { paddingTop: 16, alignItems: "center" }, footerBrandText: { color: "#89958C", fontSize: 9, fontWeight: "700" },
});
