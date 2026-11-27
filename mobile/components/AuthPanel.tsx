import { AgriText as Text } from "./AgriText";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "./Brand";
import { Button, Field } from "./Controls";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

export function AuthPanel({ mode }: { mode: "login" | "register" }) {
  const { signIn, register } = useAppStore();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [accountType, setAccountType] = useState<"RETAILER" | "SUPPLIER">("RETAILER");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  async function submit() {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid business email address."); return; }
    if (!password.trim()) { setError("Enter your password."); return; }
    if (isRegister && name.trim().length < 2) { setError("Enter your name."); return; }
    if (isRegister && organizationName.trim().length < 2) { setError("Enter your business name."); return; }
    if (isRegister && password.length < 12) { setError("Use a password with at least 12 characters."); return; }
    const normalizedPhone = phone.trim().replace(/[\s()-]/g, "");
    if (isRegister && normalizedPhone && !/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) { setError("Enter a valid phone number, including country code if needed."); return; }
    setBusy(true);
    try {
      if (isRegister) await register({ name: name.trim(), organizationName: organizationName.trim(), email: email.trim(), phone: normalizedPhone || undefined, password, accountType });
      else await signIn(email.trim(), password);
      router.replace(!isRegister && next === "checkout" ? "/checkout" : "/(tabs)");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not access your account."); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe} edges={["top"]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
    <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  Back</Text></Pressable>
    <View style={styles.brand}><Brand/></View>
    <View style={styles.intro}><Text style={styles.eyebrow}>{isRegister ? "BUSINESS ACCOUNT" : "SECURE BUSINESS ACCESS"}</Text><Text style={styles.title}>{isRegister ? "Join Agri-One" : "Welcome back"}</Text><Text style={styles.subtitle}>{isRegister ? "Create a retailer or supplier account to get started." : "Sign in to access your Agri-One workspace."}</Text></View>
    <View style={styles.form}>
      {isRegister && <><Text style={styles.label}>I am joining as</Text><View style={styles.roles}>{(["RETAILER", "SUPPLIER"] as const).map(role => <Pressable key={role} onPress={() => setAccountType(role)} style={[styles.role, accountType === role && styles.roleSelected]}><Text style={[styles.roleText, accountType === role && styles.roleTextSelected]}>{role === "RETAILER" ? "Retailer" : "Supplier"}</Text></Pressable>)}</View><Field label="Your name" placeholder="Name" autoCapitalize="words" value={name} onChangeText={setName}/><Field label={accountType === "RETAILER" ? "Store / business name" : "Supplier company name"} placeholder="Your business" autoCapitalize="words" value={organizationName} onChangeText={setOrganizationName}/><Field label="Phone number" placeholder="+91 98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone}/></>}
      <Field label="Business email" placeholder="you@business.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail}/>
      <View style={styles.passwordRow}><View style={{ flex: 1 }}><Field label="Password" placeholder={isRegister ? "At least 12 characters" : "Enter your password"} secureTextEntry={!visible} autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChangeText={setPassword}/></View><Pressable onPress={() => setVisible(value => !value)} style={styles.show}><Text style={styles.showText}>{visible ? "Hide" : "Show"}</Text></Pressable></View>
      {isRegister && <Text style={styles.reviewNote}>{accountType === "RETAILER" ? "Your retailer business needs verification before checkout is enabled." : "Your supplier business needs verification before listings can go live."}</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Button title={isRegister ? `Create ${accountType.toLowerCase()} account` : "Sign in"} onPress={submit} loading={busy}/>
    </View>
    <View style={styles.footer}><Text style={styles.footerText}>{isRegister ? "Already have an account?" : "New to Agri-One?"}</Text><Pressable onPress={() => router.replace(isRegister ? "/login" : "/register")}><Text style={styles.footerLink}>{isRegister ? "Sign in" : "Create an account"}</Text></Pressable></View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, scroll: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 28 }, back: { marginTop: 4, alignSelf: "flex-start", paddingVertical: 10, paddingRight: 12 }, backText: { color: colors.green, fontSize: 13, fontWeight: "700" }, brand: { marginTop: 22, alignItems: "center" }, intro: { marginTop: 38, marginBottom: 22 }, eyebrow: { color: colors.green, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 }, title: { marginTop: 10, color: colors.dark, fontSize: 31, fontWeight: "900", letterSpacing: -1 }, subtitle: { marginTop: 7, color: colors.muted, fontSize: 13, lineHeight: 19 }, form: { gap: 16 }, label: { marginBottom: -8, color: colors.dark, fontSize: 12, fontWeight: "700" }, roles: { flexDirection: "row", gap: 9 }, role: { flex: 1, paddingVertical: 13, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, roleSelected: { borderColor: colors.green, backgroundColor: colors.greenTint }, roleText: { color: colors.muted, fontWeight: "700", fontSize: 12 }, roleTextSelected: { color: colors.green }, passwordRow: { flexDirection: "row", alignItems: "flex-end" }, show: { height: 48, marginLeft: 8, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, showText: { color: colors.green, fontSize: 11, fontWeight: "800" }, reviewNote: { color: colors.muted, fontSize: 10, lineHeight: 15 }, error: { padding: 11, borderRadius: 9, backgroundColor: "#FFF0ED", color: colors.red, fontSize: 11, lineHeight: 16 }, footer: { marginTop: 23, flexDirection: "row", justifyContent: "center", gap: 5 }, footerText: { color: colors.muted, fontSize: 11 }, footerLink: { color: colors.green, fontSize: 11, fontWeight: "800" } });
