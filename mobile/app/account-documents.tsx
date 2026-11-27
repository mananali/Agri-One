import { AgriText as Text } from "../components/AgriText";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { apiRequest, type ComplianceDocument } from "../src/api";
import { useAppStore } from "../src/store";

type IdTab = "AADHAAR" | "GST" | "PAN" | "VOTER_ID" | "LICENSE";
type Slot = "AADHAAR_FRONT" | "AADHAAR_BACK" | "GST_CERTIFICATE" | "PAN_CARD" | "VOTER_ID_FRONT" | "VOTER_ID_BACK" | "LICENSE";
type PickedPhoto = { uri: string; name: string; mimeType: string; file?: Blob; size?: number };
const tabs: Array<{ id: Exclude<IdTab, "LICENSE">; label: string; types: Slot[]; slots: Array<{ type: Slot; label: string }> }> = [
  { id: "AADHAAR", label: "Aadhaar", types: ["AADHAAR_FRONT", "AADHAAR_BACK"], slots: [{ type: "AADHAAR_FRONT", label: "Front" }, { type: "AADHAAR_BACK", label: "Back" }] },
  { id: "GST", label: "GST", types: ["GST_CERTIFICATE"], slots: [{ type: "GST_CERTIFICATE", label: "GST certificate photo" }] },
  { id: "PAN", label: "PAN", types: ["PAN_CARD"], slots: [{ type: "PAN_CARD", label: "PAN card photo" }] },
  { id: "VOTER_ID", label: "Voter ID", types: ["VOTER_ID_FRONT", "VOTER_ID_BACK"], slots: [{ type: "VOTER_ID_FRONT", label: "Front" }, { type: "VOTER_ID_BACK", label: "Back" }] },
];
const labelFor: Record<Slot | "SUPPORTING_ID", string> = { AADHAAR_FRONT: "Aadhaar · Front", AADHAAR_BACK: "Aadhaar · Back", GST_CERTIFICATE: "GST Certificate", PAN_CARD: "PAN Card", VOTER_ID_FRONT: "Voter ID · Front", VOTER_ID_BACK: "Voter ID · Back", LICENSE: "Business License", SUPPORTING_ID: "Supporting ID" };
const accepted = ["PENDING", "NEEDS_CORRECTION"];

function humanStatus(status: string) {
  if (status === "APPROVED") return "APPROVED";
  if (status === "NEEDS_CORRECTION" || status === "REJECTED") return "ACTION NEEDED";
  return "IN REVIEW";
}

export default function AccountDocumentsScreen() {
  const { token } = useAppStore();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [selected, setSelected] = useState<IdTab>(params.tab?.toUpperCase() === "LICENSE" ? "LICENSE" : "AADHAAR");
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [staged, setStaged] = useState<Partial<Record<Slot, PickedPhoto>>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setSelected(params.tab?.toUpperCase() === "LICENSE" ? "LICENSE" : "AADHAAR"); }, [params.tab]);
  const load = useCallback(async () => {
    if (!token) { setDocuments([]); return; }
    setLoading(true); setError("");
    try { setDocuments(await apiRequest<ComplianceDocument[]>("/auth/me/documents", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Documents could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeTab = tabs.find(tab => tab.id === selected) ?? tabs[0];
  const currentDocuments = useMemo(() => selected === "LICENSE" ? documents.filter(doc => doc.documentType === "LICENSE") : documents.filter(doc => activeTab.types.includes(doc.documentType as Slot)), [documents, selected, activeTab]);
  const complete = selected !== "LICENSE" && activeTab.types.every(type => documents.some(doc => doc.documentType === type && doc.reviewStatus === "APPROVED"));
  const allStaged = Object.keys(staged).length > 0;

  const choosePhoto = async (slot: Slot) => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 8 * 1024 * 1024) { setError("Choose a JPG or PNG photo under 8 MB."); return; }
    const mimeType = asset.mimeType ?? (asset.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    setStaged(current => ({ ...current, [slot]: { uri: asset.uri, name: asset.name, mimeType, ...(asset.file ? { file: asset.file } : {}), size: asset.size } }));
    setError("");
  };
  const chooseLicense = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 8 * 1024 * 1024) { setError("Choose a PDF, JPG, or PNG file under 8 MB."); return; }
    const mimeType = asset.mimeType ?? (asset.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : asset.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    setStaged(current => ({ ...current, LICENSE: { uri: asset.uri, name: asset.name, mimeType, ...(asset.file ? { file: asset.file } : {}), size: asset.size } }));
    setError("");
  };
  const submit = async () => {
    if (!token || !allStaged) return;
    setUploading(true); setError("");
    try {
      for (const [type, asset] of Object.entries(staged) as Array<[Slot, PickedPhoto | undefined]>) {
        if (!asset) continue;
        const data = new FormData(); data.append("documentType", type);
        const extension = asset.mimeType === "image/png" ? "png" : asset.mimeType === "application/pdf" ? "pdf" : "jpg";
        const safeName = `${type.toLowerCase()}.${extension}`;
        if (asset.file) data.append("file", asset.file, safeName);
        else data.append("file", { uri: asset.uri, name: safeName, type: asset.mimeType } as unknown as Blob);
        await apiRequest<ComplianceDocument>("/auth/me/documents", token, { method: "POST", body: data });
        setStaged(current => { const next = { ...current }; delete next[type]; return next; });
      }
      await load();
      Alert.alert("Submitted for review", "Your document photo has been securely submitted for manual verification.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Document photo could not be uploaded."); }
    finally { setUploading(false); }
  };
  const remove = (document: ComplianceDocument) => Alert.alert("Remove document?", "This document photo will be deleted from your account.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => { try { await apiRequest(`/auth/me/documents/${document.id}`, token, { method: "DELETE" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Document could not be removed."); } } },
  ]);
  const help = () => void Linking.openURL("tel:+919933329102");

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>{selected === "LICENSE" ? "License" : "Supporting ID"}</Text><Pressable accessibilityRole="button" onPress={help} style={styles.help}><Text style={styles.helpGlyph}>☎</Text><Text style={styles.helpText}>Help</Text></Pressable></View>
    {!token ? <View style={styles.center}><Text style={styles.centerTitle}>Sign in to manage your documents</Text><Pressable onPress={() => router.push("/login")} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable></View> : loading && documents.length === 0 ? <ActivityIndicator style={{ marginTop: 30 }} color="#087443"/> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>{selected === "LICENSE" ? "Upload your business license for verification." : "View submitted documents or add missing ones."}</Text>
      {selected !== "LICENSE" && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map(tab => {
        const tabApproved = tab.types.every(type => documents.some(doc => doc.documentType === type && doc.reviewStatus === "APPROVED"));
        const active = selected === tab.id;
        return <Pressable key={tab.id} onPress={() => { setSelected(tab.id); setError(""); }} style={[styles.tab, active && styles.tabActive, tabApproved && !active && styles.tabApproved]}><Text style={[styles.tabText, active && styles.tabTextActive, tabApproved && !active && styles.tabApprovedText]}>{tabApproved ? "✓ " : ""}{tab.label}</Text></Pressable>;
      })}</ScrollView>}
      {complete ? <View style={styles.approvedCard}><View style={styles.approvedTop}><Text style={styles.approvedTitle}>{activeTab.label}</Text><View style={styles.approvedBadge}><Text style={styles.approvedBadgeText}>✓  APPROVED</Text></View></View><Text style={styles.approvedSub}>Verified by Agri-One review</Text><View style={styles.rule}/>{currentDocuments.filter(doc => doc.reviewStatus === "APPROVED").map(doc => <View key={doc.id} style={styles.approvedRow}><Text style={styles.approvedLabel}>{labelFor[doc.documentType as Slot] ?? activeTab.label}</Text><Text numberOfLines={1} style={styles.approvedFile}>Photo verified</Text></View>)}<View style={styles.lockNote}><Text style={styles.lockGlyph}>♙</Text><Text style={styles.lockCopy}>Approved documents can't be edited. Need a change? <Text onPress={help} style={styles.supportLink}>Contact Support to Edit</Text></Text></View></View> : <>
        {selected === "LICENSE" ? <View style={styles.formCard}><Text style={styles.sectionTitle}>Upload business license</Text><Text style={styles.caption}>Manual review · 1–2 working days</Text><UploadSlot title="Tap to upload business license" file={staged.LICENSE} existing={currentDocuments.find(doc => doc.reviewStatus !== "REJECTED")} onPress={() => void chooseLicense()} onRemove={remove} uploading={uploading}/></View> : <>
          <View style={styles.guide}><Text style={styles.guideTitle}>Upload {activeTab.label} photo</Text><Text style={styles.guideCopy}>Use a clear JPG or PNG photo. Your file is private and will be reviewed by our team.</Text></View>
          <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.sectionTitle}>{activeTab.slots.length > 1 ? `Upload ${activeTab.label}` : `Upload ${activeTab.label} photo`}</Text><View style={styles.manualBadge}><Text style={styles.manualText}>MANUAL VERIFY</Text></View></View><Text style={styles.caption}>Manual review · 1–2 working days</Text><View style={[styles.slotRow, activeTab.slots.length === 1 && styles.singleSlot]}>{activeTab.slots.map(slot => <UploadSlot key={slot.type} title={slot.label} file={staged[slot.type]} existing={currentDocuments.find(doc => doc.documentType === slot.type && doc.reviewStatus !== "REJECTED")} onPress={() => void choosePhoto(slot.type)} onRemove={remove} uploading={uploading}/>)}</View></View>
          <View style={styles.orRow}><View style={styles.orLine}/><Text style={styles.orText}>OR</Text><View style={styles.orLine}/></View>
          <View style={styles.uploadInstead}><View style={styles.imageIcon}><Text style={styles.imageGlyph}>▧</Text></View><View style={styles.uploadInsteadCopy}><Text style={styles.uploadInsteadTitle}>Upload {activeTab.label} photo</Text><Text style={styles.uploadInsteadSub}>JPG or PNG · Maximum 8 MB per photo</Text></View></View>
        </>}
        {!!currentDocuments.length && <View style={styles.submittedList}><Text style={styles.submittedTitle}>Submitted documents</Text>{currentDocuments.map(doc => <View key={doc.id} style={styles.submittedRow}><View style={{ flex: 1 }}><Text style={styles.submittedName}>{labelFor[doc.documentType as Slot] ?? "Supporting document"}</Text><Text style={styles.submittedStatus}>{humanStatus(doc.reviewStatus)}{doc.reviewReason ? ` · ${doc.reviewReason}` : ""}</Text></View>{accepted.includes(doc.reviewStatus) && <Pressable onPress={() => remove(doc)}><Text style={styles.removeText}>Remove</Text></Pressable>}</View>)}</View>}
        <Pressable disabled={!allStaged || uploading} onPress={() => void submit()} style={[styles.primary, (!allStaged || uploading) && styles.primaryDisabled]}>{uploading ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.primaryText}>Submit for Review</Text>}</Pressable>
      </>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>}
  </SafeAreaView>;
}

function UploadSlot({ title, file, existing, onPress, onRemove, uploading }: { title: string; file?: PickedPhoto; existing?: ComplianceDocument; onPress: () => void; onRemove: (document: ComplianceDocument) => void; uploading: boolean }) {
  if (existing) return <View style={[styles.slot, styles.existingSlot]}><Text numberOfLines={2} style={styles.slotTitle}>{title}</Text><Text style={styles.slotStatus}>{humanStatus(existing.reviewStatus)}</Text>{accepted.includes(existing.reviewStatus) && <Pressable onPress={() => onRemove(existing)}><Text style={styles.removeText}>Remove</Text></Pressable>}</View>;
  return <Pressable disabled={uploading} onPress={onPress} style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}>{file ? <Image source={{ uri: file.uri }} style={styles.thumbnail}/> : <View style={styles.plusCircle}><Text style={styles.plus}>＋</Text></View>}<Text numberOfLines={2} style={styles.slotTitle}>{title}</Text>{!file && <Text style={styles.tapHint}>Tap to upload</Text>}</Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" }, header: { minHeight: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#EAEAEA" }, backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E6E6E6", borderRadius: 18 }, back: { color: "#191919", fontSize: 23, lineHeight: 25 }, title: { flex: 1, color: "#111111", fontSize: 18, fontWeight: "900", letterSpacing: -0.4 }, help: { minHeight: 30, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#E6E6E6", borderRadius: 18 }, helpGlyph: { color: "#252525", fontSize: 13 }, helpText: { color: "#262626", fontSize: 11, fontWeight: "700" }, content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 25 }, intro: { marginBottom: 12, color: "#656565", fontSize: 13, lineHeight: 19 }, tabs: { gap: 9, paddingBottom: 13 }, tab: { minHeight: 32, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E7E7E7", borderRadius: 22, backgroundColor: "#FFFFFF" }, tabActive: { borderColor: "#00834F", backgroundColor: "#00834F" }, tabApproved: { borderColor: "#00834F", backgroundColor: "#EFFBF5" }, tabText: { color: "#636363", fontSize: 11, fontWeight: "600" }, tabTextActive: { color: "#FFFFFF" }, tabApprovedText: { color: "#00834F" }, guide: { marginTop: 0, padding: 12, borderRadius: 10, backgroundColor: "#F7F7F7" }, guideTitle: { color: "#181818", fontSize: 12, fontWeight: "900" }, guideCopy: { marginTop: 5, color: "#747474", fontSize: 10, lineHeight: 14 }, formCard: { marginTop: 11, padding: 13, borderWidth: 1, borderColor: "#D3EDE0", borderRadius: 11, backgroundColor: "#F2FCF7" }, formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, sectionTitle: { color: "#161616", fontSize: 13, fontWeight: "900" }, manualBadge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5, backgroundColor: "#DDF5E8" }, manualText: { color: "#087B49", fontSize: 7, fontWeight: "900" }, caption: { marginTop: 4, marginBottom: 10, color: "#8A8A8A", fontSize: 9 }, slotRow: { flexDirection: "row", gap: 9 }, singleSlot: { flexDirection: "column" }, slot: { flex: 1, minHeight: 96, padding: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: "#A7AAA8", borderRadius: 10, backgroundColor: "#FFFFFF" }, slotPressed: { opacity: 0.8 }, existingSlot: { borderStyle: "solid", borderColor: "#B8E2CE", backgroundColor: "#F1FBF6" }, plusCircle: { width: 35, height: 35, marginBottom: 6, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#F5F5F5" }, plus: { color: "#555555", fontSize: 19 }, thumbnail: { width: 52, height: 40, marginBottom: 5, borderRadius: 5, backgroundColor: "#EEEEEE" }, slotTitle: { color: "#242424", fontSize: 10, fontWeight: "600", textAlign: "center" }, tapHint: { marginTop: 3, color: "#888888", fontSize: 8 }, slotStatus: { marginTop: 3, color: "#07804B", fontSize: 8, fontWeight: "900" }, orRow: { marginVertical: 13, flexDirection: "row", alignItems: "center", gap: 10 }, orLine: { flex: 1, height: 1, backgroundColor: "#E5E5E5" }, orText: { color: "#A2A2A2", fontSize: 10, fontWeight: "700" }, uploadInstead: { flexDirection: "row", alignItems: "center", gap: 10 }, imageIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#F7F7F7" }, imageGlyph: { color: "#666666", fontSize: 20 }, uploadInsteadCopy: { flex: 1 }, uploadInsteadTitle: { color: "#242424", fontSize: 12, fontWeight: "700" }, uploadInsteadSub: { marginTop: 3, color: "#A0A0A0", fontSize: 9 }, primary: { minHeight: 44, marginTop: 13, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#00834F" }, primaryDisabled: { backgroundColor: "#E2E2E2" }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, submittedList: { marginTop: 14, padding: 11, borderWidth: 1, borderColor: "#E9E9E9", borderRadius: 10 }, submittedTitle: { marginBottom: 6, color: "#222222", fontSize: 11, fontWeight: "900" }, submittedRow: { minHeight: 37, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F0F0F0" }, submittedName: { color: "#303030", fontSize: 9, fontWeight: "800" }, submittedStatus: { marginTop: 3, color: "#858585", fontSize: 8 }, removeText: { padding: 5, color: "#B84B3B", fontSize: 8, fontWeight: "800" }, approvedCard: { marginTop: 1, padding: 14, borderWidth: 1, borderColor: "#A9DCC7", borderRadius: 11, backgroundColor: "#E5FBF1" }, approvedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, approvedTitle: { color: "#00814B", fontSize: 15, fontWeight: "900" }, approvedBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: "#00834F" }, approvedBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" }, approvedSub: { marginTop: 7, color: "#66736C", fontSize: 10, fontWeight: "700" }, rule: { height: 1, marginTop: 10, marginBottom: 6, backgroundColor: "#BFE4D4" }, approvedRow: { minHeight: 27, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, approvedLabel: { color: "#63706A", fontSize: 9, fontWeight: "800" }, approvedFile: { flex: 1, color: "#202020", fontSize: 9, fontWeight: "800", textAlign: "right" }, lockNote: { minHeight: 41, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 9, backgroundColor: "#FFFFFF" }, lockGlyph: { color: "#8D9691", fontSize: 13 }, lockCopy: { flex: 1, color: "#757575", fontSize: 9, lineHeight: 14 }, supportLink: { color: "#087D4A", fontWeight: "900" }, error: { marginTop: 9, color: "#B94A36", fontSize: 9, lineHeight: 14 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }, centerTitle: { color: "#1C1C1C", fontSize: 13, fontWeight: "800" },
});
