import { AgriText as Text } from "./AgriText";
import { ImageBackground, StyleSheet, View } from "react-native";
import { colors } from "../src/theme";

export function Banner() {
  return <ImageBackground source={require("../assets/images/agri-one-banner.png")} resizeMode="cover" imageStyle={styles.image} style={styles.banner}>
    <View style={styles.tint}/><View style={styles.copy}><Text style={styles.kicker}>AGRI-ONE MARKETPLACE</Text><Text style={styles.title}>Better farming starts here.</Text><Text style={styles.caption}>Trusted products for your business</Text></View>
  </ImageBackground>;
}
const styles = StyleSheet.create({ banner: { height: 178, overflow: "hidden", borderRadius: 18, justifyContent: "flex-end", backgroundColor: "#1B6435" }, image: { borderRadius: 18 }, tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,46,25,.22)" }, copy: { padding: 17 }, kicker: { color: "#E8F6E8", fontSize: 9, fontWeight: "800", letterSpacing: 1.1 }, title: { marginTop: 6, color: colors.white, fontSize: 21, lineHeight: 26, fontWeight: "900", maxWidth: 245 }, caption: { marginTop: 4, color: "#F4FFF1", fontSize: 11, fontWeight: "600" } });
