import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Button, Panel } from "../components/Controls";
import { apiRequest, type RetailerBusinessProfile } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

const blank: RetailerBusinessProfile = { gstin: "", panNumber: "", bankAccountName: "", bankAccountNumber: "", bankIfsc: "", verificationStatus: "PENDING", isLocked: false };
export default function RetailerProfileScreen() {
  const { token } = useAppStore();
  const [profile, setProfile] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError("");
    try { setProfile(await apiRequest<RetailerBusinessProfile>("/auth/me/retailer-profile", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Business profile could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  const refreshVerificationStatus = useCallback(async () => {
    if (!token) return;
    try {
      const latest = await apiRequest<RetailerBusinessProfile>("/auth/me/retailer-profile", token);
      setProfile(current => ({ ...current, verificationStatus: latest.verificationStatus, isLocked: latest.isLocked }));
    } catch { /* Keep the last known status until the API is reachable again. */ }
  }, [token]);
  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void refreshVerificationStatus(), 30_000);
    return () => clearInterval(timer);
  }, [load, refreshVerificationStatus]));
  const update = (key: keyof RetailerBusinessProfile, value: string) => setProfile(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (!token) return;
    const fields = { gstin: profile.gstin.trim().toUpperCase(), panNumber: profile.panNumber.trim().toUpperCase(), bankAccountName: profile.bankAccountName.trim(), bankAccountNumber: profile.bankAccountNumber.replace(/\s/g, ""), bankIfsc: profile.bankIfsc.trim().toUpperCase() };
    const payload = Object.fromEntries(Object.entries(fields).filter(([, value]) => Boolean(value)));
    if (fields.gstin && !/^[0-9A-Z]{15}$/.test(fields.gstin)) { setError("GSTIN must contain 15 letters and numbers."); return; }
    if (fields.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(fields.panNumber)) { setError("Enter a valid PAN format."); return; }
    if (fields.bankAccountNumber && !/^\d{6,34}$/.test(fields.bankAccountNumber)) { setError("Bank account number must contain 6–34 digits."); return; }
    if (fields.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(fields.bankIfsc)) { setError("Enter a valid IFSC code."); return; }
    if (!Object.keys(payload).length) { setError("Enter at least one business detail to save."); return; }
    setSaving(true); setError(""); setNotice("");
    try { setProfile(await apiRequest<RetailerBusinessProfile>("/auth/me/retailer-profile", token, { method: "PATCH", body: JSON.stringify(payload) })); setNotice("Business details saved securely."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Business details could not be saved."); }
    finally { setSaving(false); }
  };
  if (!token) return <SafeAreaView style={styles.safe} edges={["top"]}><View style={styles.center}><Text style={styles.title}>Sign in to manage your business profile</Text><Button title="Sign in" onPress={() => router.push("/login")}/></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Back to profile</Text></Pressable><Text style={styles.title}>Retailer Business Profile</Text><Text style={styles.subtitle}>Business identifiers and payout account details.</Text>
    {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 30 }}/> : <>
      <View style={styles.sectionHead}><Text style={styles.section}>Tax & identity</Text><Text style={styles.status}>{profile.verificationStatus.replaceAll("_", " ")}</Text></View>
      <Panel style={styles.form}><Text style={styles.label}>GSTIN</Text><TextInput value={profile.gstin} onChangeText={value => update("gstin", value)} autoCapitalize="characters" maxLength={15} placeholder="15-character GSTIN" style={styles.input}/><Text style={styles.label}>PAN</Text><TextInput value={profile.panNumber} onChangeText={value => update("panNumber", value)} autoCapitalize="characters" maxLength={10} secureTextEntry placeholder="ABCDE1234F" style={styles.input}/></Panel>
      <Text style={styles.section}>Bank details</Text><Panel style={styles.form}><Text style={styles.label}>ACCOUNT HOLDER NAME</Text><TextInput value={profile.bankAccountName} onChangeText={value => update("bankAccountName", value)} autoCapitalize="words" placeholder="Name as shown by bank" style={styles.input}/><Text style={styles.label}>ACCOUNT NUMBER</Text><TextInput value={profile.bankAccountNumber} onChangeText={value => update("bankAccountNumber", value)} keyboardType="number-pad" secureTextEntry placeholder="Bank account number" style={styles.input}/><Text style={styles.label}>IFSC CODE</Text><TextInput value={profile.bankIfsc} onChangeText={value => update("bankIfsc", value)} autoCapitalize="characters" maxLength={11} placeholder="ABCD0123456" style={styles.input}/><Text style={styles.privacy}>PAN and bank details are encrypted before they are stored. Only your signed-in business account can view them.</Text></Panel>
      <Button title={saving ? "Saving…" : "Save business details"} loading={saving} onPress={() => void save()} style={{ marginTop: 16 }}/>
      <Button title="Upload KYC documents" variant="outline" onPress={() => router.push("/account-documents")} style={{ marginTop: 9 }}/>
    </>}
    {!!error && <Text style={styles.error}>{error}</Text>}{!!notice && <Text style={styles.notice}>{notice}</Text>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 30 }, back: { color: colors.green, fontSize: 12, fontWeight: "800" }, title: { marginTop: 12, color: colors.dark, fontSize: 23, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 11 }, sectionHead: { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, section: { marginTop: 18, marginBottom: 9, color: colors.dark, fontSize: 15, fontWeight: "900" }, status: { color: colors.green, fontSize: 9, fontWeight: "900" }, form: { gap: 8 }, label: { marginTop: 5, color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: .5 }, input: { height: 45, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 9, color: colors.dark }, privacy: { marginTop: 5, color: colors.muted, fontSize: 9, lineHeight: 14 }, error: { marginTop: 10, color: colors.red, fontSize: 10 }, notice: { marginTop: 10, color: colors.green, fontSize: 10, fontWeight: "800" }, center: { flex: 1, justifyContent: "center", padding: 24, gap: 18 },
});
