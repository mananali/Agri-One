import "react-native-reanimated";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppStore } from "../src/store";
import { colors } from "../src/theme";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansBengaliRegular: require("../assets/fonts/NotoSansBengali-Regular.ttf"),
    NotoSansBengaliBold: require("../assets/fonts/NotoSansBengali-Bold.ttf"),
  });

  if (!fontsLoaded && !fontError) return null;

  return <AppStore><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: "slide_from_right" }}>
    <Stack.Screen name="(tabs)"/><Stack.Screen name="login"/><Stack.Screen name="register"/><Stack.Screen name="checkout"/><Stack.Screen name="account-details"/><Stack.Screen name="shop-details"/><Stack.Screen name="retailer-profile"/><Stack.Screen name="account-documents"/><Stack.Screen name="account-certificate"/><Stack.Screen name="account-addresses"/><Stack.Screen name="account-money"/><Stack.Screen name="account-statement"/><Stack.Screen name="account-settings"/><Stack.Screen name="support"/><Stack.Screen name="schemes"/><Stack.Screen name="product/[slug]"/><Stack.Screen name="categories"/><Stack.Screen name="brands"/><Stack.Screen name="info/[slug]"/><Stack.Screen name="workspace"/><Stack.Screen name="wishlist"/><Stack.Screen name="order/[orderNumber]"/><Stack.Screen name="order-invoice"/>
  </Stack></AppStore>;
}
