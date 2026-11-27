import { AgriText as Text, AgriTextInput as TextInput } from "./AgriText";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type TextInputProps, type ViewStyle } from "react-native";
import { colors } from "../src/theme";
import { AgriMark } from "./AgriMark";

export function Button({ title, onPress, disabled, loading, variant = "primary", style }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: "primary" | "outline" | "plain"; style?: ViewStyle }) {
  return <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, variant === "outline" && styles.outline, variant === "plain" && styles.plain, (disabled || loading) && styles.disabled, pressed && !disabled && styles.pressed, style]}>
    {loading ? <ActivityIndicator color={variant === "primary" ? colors.white : colors.green}/> : <Text style={[styles.buttonText, variant === "outline" && styles.outlineText, variant === "plain" && styles.plainText]}>{title}</Text>}
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor="#9AA69D" style={styles.input} {...props}/></View>;
}

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><AgriMark size={31} color={colors.green}/></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{detail}</Text>{action}</View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  buttonText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  outline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, outlineText: { color: colors.green },
  plain: { backgroundColor: "transparent", paddingHorizontal: 8 }, plainText: { color: colors.green },
  disabled: { opacity: .48 }, pressed: { opacity: .83, transform: [{ scale: .99 }] },
  field: { gap: 8 }, label: { color: colors.dark, fontWeight: "700", fontSize: 12 },
  input: { height: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.white, color: colors.dark, fontSize: 14 },
  panel: { padding: 16, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 28 }, emptyIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint }, emptyTitle: { marginTop: 14, color: colors.dark, fontSize: 17, fontWeight: "800", textAlign: "center" }, emptyText: { marginTop: 7, color: colors.muted, textAlign: "center", fontSize: 13, lineHeight: 19 },
});
