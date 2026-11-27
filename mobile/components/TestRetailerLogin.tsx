import { AgriText as Text, AgriTextInput as TextInput } from "./AgriText";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useAppStore } from "../src/store";

const TEST_RETAILER_PHONE = process.env.EXPO_PUBLIC_TEST_RETAILER_PHONE ?? "9876543210";

export function TestRetailerLogin() {
  const { signInWithTestPhone } = useAppStore();
  const [phoneNumber, setPhoneNumber] = useState(TEST_RETAILER_PHONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function continueToApp() {
    setError("");
    if (!/^\d{10}$/.test(phoneNumber)) { setError("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    try {
      await signInWithTestPhone(phoneNumber);
      router.replace("/(tabs)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test login could not be completed.");
    } finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <StatusBar style="light"/>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Text style={styles.flowTitle}>Login Flow:</Text>
        <View style={styles.card}>
          <Text style={styles.brand}>Agri-One</Text>
          <Text style={styles.role}>Retailer Login</Text>
          <View style={styles.form}>
            <Text style={styles.label}>Enter Mobile Number</Text>
            <View style={styles.inputCard}>
              <Text style={styles.countryCode}>+91 Mobile Number</Text>
              <TextInput
                accessibilityLabel="10-digit mobile number"
                value={phoneNumber}
                onChangeText={(value) => { setPhoneNumber(value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                placeholder="9876543210"
                placeholderTextColor="#F2F2F2"
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                maxLength={10}
                returnKeyType="go"
                onSubmitEditing={() => { if (phoneNumber.length === 10 && !busy) void continueToApp(); }}
                style={styles.phoneInput}
              />
            </View>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Pressable
              accessibilityRole="button"
              onPress={() => void continueToApp()}
              disabled={busy || phoneNumber.length !== 10}
              style={({ pressed }) => [styles.continueButton, phoneNumber.length !== 10 && styles.continueDisabled, pressed && styles.pressed]}
            >
              <Text style={styles.continueText}>{busy ? "Signing in…" : "Continue  →"}</Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>No OTP · Test Login</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#000000" },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  flowTitle: { marginBottom: 38, color: "#F7F7F7", fontSize: 27, lineHeight: 34, fontWeight: "800" },
  card: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 23, borderWidth: 1.5, borderColor: "#1D1D1F", borderRadius: 30, backgroundColor: "#000000" },
  brand: { color: "#18A957", fontSize: 38, lineHeight: 48, fontWeight: "900", textAlign: "center", letterSpacing: -1.2 },
  role: { marginTop: 3, color: "#B8B8B8", fontSize: 17, textAlign: "center" },
  form: { marginTop: 38 },
  label: { marginBottom: 19, color: "#F4F4F4", fontSize: 22, lineHeight: 28, fontWeight: "800" },
  inputCard: { minHeight: 110, justifyContent: "center", paddingHorizontal: 17, paddingVertical: 14, borderWidth: 1.5, borderColor: "#1C1C1E", borderRadius: 23, backgroundColor: "#020202" },
  countryCode: { color: "#A7A7A7", fontSize: 17, lineHeight: 23 },
  phoneInput: { marginTop: 7, paddingVertical: 0, color: "#FFFFFF", fontSize: 29, lineHeight: 38, fontWeight: "800", letterSpacing: 1.2 },
  error: { marginTop: 10, color: "#FF8B83", fontSize: 13 },
  continueButton: { minHeight: 70, marginTop: 22, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#16834B" },
  continueDisabled: { opacity: 0.52 },
  continueText: { color: "#FFFFFF", fontSize: 21, fontWeight: "800" },
  pressed: { opacity: 0.83 },
  footer: { marginTop: 22, color: "#A7A7A7", fontSize: 16, textAlign: "center" },
});
