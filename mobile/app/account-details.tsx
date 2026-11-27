import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppStore } from "../src/store";

export default function AccountDetailsScreen() {
  const { token, user, organization, updateProfile, loadingSession } = useAppStore();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [organizationName, setOrganizationName] = useState(organization?.name ?? "");
  const [businessEntityType, setBusinessEntityType] = useState<"PROPRIETOR" | "PRIVATE_LIMITED" | "PARTNERSHIP" | null>(organization?.businessEntityType ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setName(user?.name ?? ""); setPhone(user?.phone ?? ""); setOrganizationName(organization?.name ?? ""); setBusinessEntityType(organization?.businessEntityType ?? null); }, [user, organization]);
  const save = async () => {
    setSaving(true); setError("");
    try { await updateProfile({ name: name.trim(), phone: phone.trim() || null, ...(organization && organization.verificationStatus !== "APPROVED" ? { organizationName: organizationName.trim() } : {}), ...(businessEntityType ? { businessEntityType } : {}) }); router.back(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setSaving(false); }
  };
  if (loadingSession) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#087443" /></SafeAreaView>;
  if (!token) return <SafeAreaView style={styles.safe}><Text style={styles.heading}>Sign in to edit your profile</Text><Pressable onPress={() => router.push("/login")} style={styles.button}><Text style={styles.buttonText}>Sign in</Text></Pressable></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.title}>Edit Profile</Text><Text style={styles.subtitle}>Keep your details up to date</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>FULL NAME</Text><TextInput value={name} onChangeText={setName} style={styles.input} autoCapitalize="words"/>
      <Text style={styles.label}>MOBILE NUMBER</Text><TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad"/>
      <Text style={styles.label}>EMAIL</Text><View style={styles.readonly}><Text style={styles.value}>{user?.email}</Text></View>
      {!!organization && <><Text style={styles.label}>BUSINESS ENTITY TYPE</Text><View style={styles.entityRow}>{([{ key: "PROPRIETOR", label: "Proprietor" }, { key: "PRIVATE_LIMITED", label: "Pvt Ltd" }, { key: "PARTNERSHIP", label: "Partnership" }] as const).map(item => <Pressable key={item.key} disabled={organization.verificationStatus === "APPROVED"} onPress={() => setBusinessEntityType(item.key)} style={[styles.entityOption, businessEntityType === item.key && styles.entitySelected]}><Text style={[styles.entityText, businessEntityType === item.key && styles.entityTextSelected]}>{item.label}</Text></Pressable>)}</View></>}
      {!!organization && <><Text style={styles.label}>SHOP / BUSINESS NAME</Text>{organization.verificationStatus === "APPROVED" ? <View style={styles.readonly}><Text style={styles.value}>{organization.name}</Text></View> : <TextInput value={organizationName} onChangeText={setOrganizationName} style={styles.input} autoCapitalize="words"/>}</>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.button, saving && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.buttonText}>Save Changes</Text>}</Pressable>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 17 }, header: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#ECEEEC" }, back: { width: 36, height: 36, marginRight: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E7E9E7", borderRadius: 20 }, backText: { color: "#202521", fontSize: 24 }, title: { color: "#171B19", fontSize: 18, fontWeight: "900" }, subtitle: { marginTop: 3, color: "#6F7771", fontSize: 11 }, content: { paddingVertical: 18 }, label: { marginTop: 15, color: "#858D87", fontSize: 10, fontWeight: "800" }, input: { height: 45, marginTop: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E4E7E5", borderRadius: 10, color: "#272C28", fontSize: 13 }, readonly: { minHeight: 45, marginTop: 7, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: "#E4E7E5", borderRadius: 10, backgroundColor: "#FAFAFA" }, value: { color: "#303632", fontSize: 13 }, entityRow: { marginTop: 7, flexDirection: "row", gap: 7 }, entityOption: { flex: 1, minHeight: 39, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E4E7E5", borderRadius: 9 }, entitySelected: { borderColor: "#087443", backgroundColor: "#F1F8F3" }, entityText: { color: "#6C746E", fontSize: 10, fontWeight: "700" }, entityTextSelected: { color: "#087443" }, button: { minHeight: 44, marginTop: 22, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#087443" }, buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, error: { marginTop: 12, color: "#B94A36", fontSize: 11 }, heading: { marginTop: 40, textAlign: "center", color: "#203A2B", fontSize: 16, fontWeight: "800" } });
