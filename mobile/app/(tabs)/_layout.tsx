import { Tabs, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgriText as Text } from "../../components/AgriText";
import { colors } from "../../src/theme";
import { useAppStore } from "../../src/store";

const visibleTabs = ["index", "explore", "cart", "orders", "account"] as const;
type VisibleTab = typeof visibleTabs[number];

const tabIcons = {
  index: { ios: "house.fill", android: "home", web: "home" },
  explore: { ios: "bag", android: "shopping_bag", web: "shopping_bag" },
  cart: { ios: "cart", android: "shopping_cart", web: "shopping_cart" },
  orders: { ios: "shippingbox", android: "inventory_2", web: "inventory_2" },
  account: { ios: "person.crop.circle", android: "person", web: "person" },
} as const;

function AgriTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { cart } = useAppStore();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const routes = visibleTabs.flatMap(name => {
    const route = state.routes.find(item => item.name === name);
    return route ? [route] : [];
  });

  return <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, 5) }]}>
    <View style={styles.bar}>
      {routes.map((route, index) => {
        const focused = state.routes[state.index]?.key === route.key;
        const options = descriptors[route.key].options;
        const label = typeof options.tabBarLabel === "string" ? options.tabBarLabel : options.title ?? route.name;
        const name = route.name as VisibleTab;
        const tint = focused ? "#119B3B" : "#171A18";
        return <Pressable
          key={route.key}
          accessibilityRole="tab"
          accessibilityState={focused ? { selected: true } : {}}
          accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          testID={options.tabBarButtonTestID}
          onPress={() => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }}
          onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          {focused && <View style={styles.activeIndicator} />}
          {index > 0 && <View pointerEvents="none" style={styles.divider} />}
          <View style={styles.iconBox}>
            <SymbolView name={tabIcons[name]} size={35} tintColor={tint} />
            {name === "cart" && cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>}
          </View>
          <Text numberOfLines={1} style={[styles.label, { color: tint }, focused && styles.activeLabel]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export default function TabLayout() {
  const { token, loadingSession } = useAppStore();
  useEffect(() => {
    if (__DEV__ && !loadingSession && !token) router.replace("/login");
  }, [loadingSession, token]);
  if (__DEV__ && !loadingSession && !token) return null;
  return <Tabs tabBar={props => <AgriTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" options={{ title: "Home" }} />
    <Tabs.Screen name="explore" options={{ title: "Products" }} />
    <Tabs.Screen name="cart" options={{ title: "Cart" }} />
    <Tabs.Screen name="orders" options={{ title: "Orders" }} />
    <Tabs.Screen name="account" options={{ title: "Profile" }} />
    <Tabs.Screen name="business" options={{ href: null }} />
    <Tabs.Screen name="stock" options={{ href: null }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  safeArea: { paddingHorizontal: 4, paddingTop: 4, backgroundColor: "#F4F4F4" },
  bar: { height: 78, flexDirection: "row", alignItems: "stretch", padding: 2, borderWidth: 1, borderColor: "#E6E6E6", borderRadius: 42, backgroundColor: "#FFFFFF", shadowColor: "#000000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 7, elevation: 5 },
  tab: { flex: 1, minWidth: 0, position: "relative", alignItems: "center", justifyContent: "center", borderRadius: 27 },
  activeIndicator: { position: "absolute", bottom: -2, width: "76%", height: 5, borderRadius: 4, backgroundColor: "#16A83D" },
  divider: { position: "absolute", left: 0, top: 16, bottom: 16, width: 1, backgroundColor: "#D9D9D9" },
  iconBox: { width: 38, height: 38, position: "relative", alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -5, right: -8, minWidth: 21, height: 21, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#E83437", borderWidth: 1, borderColor: "#FFFFFF" },
  cartBadgeText: { color: "#FFFFFF", fontSize: 12, lineHeight: 15, fontWeight: "900" },
  label: { marginTop: 1, fontSize: 14, lineHeight: 19, fontWeight: "600", textAlign: "center" },
  activeLabel: { fontWeight: "700" },
  pressed: { opacity: 0.82 },
});
