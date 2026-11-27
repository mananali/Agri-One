import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { apiRequest, type CertificateApplication } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

function statusStyle(status: string) {
  if (status === "APPROVED") return styles.approved;
  if (status === "REJECTED" || status === "NEEDS_CORRECTION") return styles.needsAction;
  return styles.pending;
}

export default function CertificateScreen() {
  const { token } = useAppStore();
  const [applications, setApplications] = useState<CertificateApplication[]>([]);
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try { setApplications(await apiRequest<CertificateApplication[]>("/auth/me/certificate-applications", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Applications could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const submit = async () => {
    setSaving(true); setError("");
    try { await apiRequest("/auth/me/certificate-applications", token, { method: "POST", body: JSON.stringify({ purpose: purpose.trim() || undefined }) }); setPurpose(""); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Application could not be submitted."); }
    finally { setSaving(false); }
  };

  if (!token) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Sign in to apply</Text><Pressable style={styles.button} onPress={() => router.push("/login")}><Text style={styles.buttonText}>Sign in</Text></Pressable></View></SafeAreaView>;
  const pending = applications.some(application => application.status === "PENDING");
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Principal Certificate</Text><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Apply for a principal certificate through Agri-One. Your request will be recorded for business review.</Text>
      <View style={styles.card}><Text style={styles.fieldLabel}>CERTIFICATE TYPE</Text><Text style={styles.certificate}>Principal Certificate</Text><Text style={styles.fieldLabel}>PURPOSE (OPTIONAL)</Text><TextInput value={purpose} onChangeText={setPurpose} placeholder="Tell us what you need this certificate for" placeholderTextColor="#9AA49D" multiline maxLength={1000} style={styles.input} /></View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable disabled={saving || pending} onPress={() => void submit()} style={[styles.button, (saving || pending) && styles.disabled]}><Text style={styles.buttonText}>{saving ? "Submitting…" : pending ? "Application pending" : "Submit application"}</Text></Pressable>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your applications</Text><Pressable onPress={() => void load()}><Text style={styles.refresh}>Refresh</Text></Pressable></View>
      {loading && applications.length === 0 ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.green} /> : !applications.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No applications yet</Text><Text style={styles.emptyText}>Your certificate requests and review updates will appear here.</Text></View> : applications.map(application => <View key={application.id} style={styles.application}>
        <View style={styles.appTop}><View><Text style={styles.appTitle}>Principal Certificate</Text><Text style={styles.appDate}>{new Date(application.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></View><View style={[styles.badge, statusStyle(application.status)]}><Text style={styles.badgeText}>{application.status.replaceAll("_", " ").toLowerCase()}</Text></View></View>
        {!!application.purpose && <Text style={styles.appPurpose}>{application.purpose}</Text>}{!!application.reviewReason && <Text style={styles.reviewReason}>{application.reviewReason}</Text>}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white }, back: { width: 28, color: colors.dark, fontSize: 34 }, headerTitle: { color: colors.dark, fontSize: 14, fontWeight: "900" }, spacer: { width: 28 }, content: { padding: 17, paddingBottom: 30 }, intro: { marginBottom: 14, color: colors.muted, fontSize: 11, lineHeight: 17 }, card: { padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white }, fieldLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: .7 }, certificate: { marginTop: 7, marginBottom: 18, color: colors.dark, fontSize: 14, fontWeight: "900" }, input: { minHeight: 82, marginTop: 8, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 10, color: colors.dark, fontSize: 11, textAlignVertical: "top" }, button: { minHeight: 46, marginTop: 13, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.green }, buttonText: { color: colors.white, fontSize: 11, fontWeight: "900" }, disabled: { opacity: .55 }, error: { marginTop: 10, color: colors.red, fontSize: 10, lineHeight: 15 }, sectionHeader: { marginTop: 23, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { color: colors.dark, fontSize: 14, fontWeight: "900" }, refresh: { color: colors.green, fontSize: 10, fontWeight: "800" }, empty: { padding: 17, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white }, emptyTitle: { color: colors.dark, fontSize: 12, fontWeight: "900" }, emptyText: { marginTop: 5, color: colors.muted, fontSize: 10, lineHeight: 15 }, application: { marginBottom: 9, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white }, appTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, appTitle: { color: colors.dark, fontSize: 11, fontWeight: "900" }, appDate: { marginTop: 4, color: colors.muted, fontSize: 9 }, badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 }, pending: { backgroundColor: "#FFF7E6" }, approved: { backgroundColor: "#E8F6EF" }, needsAction: { backgroundColor: "#FFF0EE" }, badgeText: { color: colors.green, fontSize: 8, fontWeight: "900", textTransform: "capitalize" }, appPurpose: { marginTop: 10, color: colors.muted, fontSize: 10 }, reviewReason: { marginTop: 8, color: colors.red, fontSize: 10 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, title: { color: colors.dark, fontSize: 15, fontWeight: "900" } });
