import { StyleSheet, View } from "react-native";

export function AgriMark({ size = 40, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return <View accessible={false} style={{ width: size, height: size }}>
    <View style={[styles.leaf, styles.leftLeaf, { backgroundColor: color }]} />
    <View style={[styles.leaf, styles.rightLeaf, { backgroundColor: color }]} />
    <View style={[styles.stem, { backgroundColor: color }]} />
  </View>;
}

const styles = StyleSheet.create({
  leaf: { position: "absolute", width: "44%", height: "28%", borderRadius: 999 },
  leftLeaf: { left: "8%", top: "25%", transform: [{ rotate: "28deg" }] },
  rightLeaf: { right: "8%", top: "15%", transform: [{ rotate: "-28deg" }] },
  stem: { position: "absolute", left: "47%", top: "39%", width: "7%", height: "45%", borderRadius: 999 },
});
