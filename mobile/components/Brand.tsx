import { AgriText as Text } from "./AgriText";
import { View, StyleSheet } from "react-native";
import { colors } from "../src/theme";
import { AgriMark } from "./AgriMark";

export function Brand({ subtitle = true, small = false }: { subtitle?: boolean; small?: boolean }) {
  const markSize = small ? 33 : 40;
  return <View style={styles.wrap}><View style={[styles.mark, { width: markSize, height: markSize, borderRadius: small ? 11 : 13 }]}><AgriMark size={markSize * .72}/></View><View><Text style={[styles.name, small && styles.nameSmall]}>Agri-One</Text>{subtitle && <Text style={styles.subtitle}>SMART FARMING SOLUTIONS</Text>}</View></View>;
}

const styles = StyleSheet.create({ wrap: { flexDirection: "row", alignItems: "center", gap: 10 }, mark: { backgroundColor: colors.green, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-5deg" }] }, name: { color: colors.dark, fontSize: 19, fontWeight: "800", letterSpacing: -.4 }, nameSmall: { fontSize: 16 }, subtitle: { color: colors.muted, fontSize: 7, fontWeight: "700", letterSpacing: 1.05, marginTop: 2 } });
