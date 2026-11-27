import { AgriText as Text, AgriTextInput as TextInput } from "../components/AgriText";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Button, Panel } from "../components/Controls";
import { apiRequest, type SupportTicket } from "../src/api";
import { useAppStore } from "../src/store";
import { colors } from "../src/theme";

const supportPhone = "+919933329102";
export default function SupportScreen() {
  const { token } = useAppStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try { setTickets(await apiRequest<SupportTicket[]>("/support/tickets", token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Support tickets could not be loaded."); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const create = async () => {
    if (!token) { router.push("/login"); return; }
    if (subject.trim().length < 4 || message.trim().length < 10) { setError("Subject needs 4+ characters and complaint details need 10+ characters."); return; }
    setSending(true); setError("");
    try { await apiRequest("/support/tickets", token, { method: "POST", body: JSON.stringify({ subject: subject.trim(), message: message.trim() }) }); setSubject(""); setMessage(""); await load(); Alert.alert("Complaint submitted", "Our support team will review your ticket."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your complaint could not be submitted."); }
    finally { setSending(false); }
  };
  const open = async (url: string) => { try { await Linking.openURL(url); } catch { setError("This support app is not available on this device."); } };
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable><Text style={styles.title}>Retailer Support</Text><Text style={styles.subtitle}>Get help with orders, payments, shop verification or products.</Text>
    <View style={styles.contactRow}><Pressable onPress={() => void open(`https://wa.me/${supportPhone.slice(1)}?text=Hello%20Agri-One%20support`)} style={styles.contact}><Text style={styles.contactIcon}>◉</Text><Text style={styles.contactTitle}>WhatsApp</Text><Text style={styles.contactSub}>Chat with support</Text></Pressable><Pressable onPress={() => void open(`tel:${supportPhone}`)} style={styles.contact}><Text style={styles.contactIcon}>☎</Text><Text style={styles.contactTitle}>Call support</Text><Text style={styles.contactSub}>{supportPhone}</Text></Pressable></View>
    <Text style={styles.section}>Raise a complaint</Text><Panel style={styles.form}><Text style={styles.fieldLabel}>SUBJECT</Text><TextInput value={subject} onChangeText={setSubject} maxLength={160} placeholder="Order, payment, product…" style={styles.input}/><Text style={styles.fieldLabel}>DETAILS</Text><TextInput value={message} onChangeText={setMessage} maxLength={3000} multiline textAlignVertical="top" placeholder="Tell us what happened and how we can help" style={styles.message}/><Button title={sending ? "Submitting…" : "Submit complaint"} loading={sending} onPress={() => void create()} /></Panel>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.ticketHeading}><Text style={styles.section}>My complaint tickets</Text><Pressable onPress={() => void load()}><Text style={styles.refresh}>Refresh</Text></Pressable></View>
    {loading && !tickets.length ? <ActivityIndicator color={colors.green} style={{ marginTop: 20 }}/> : !token ? <Panel><Text style={styles.ticketCopy}>Sign in to submit complaints and track replies.</Text><Button title="Sign in" onPress={() => router.push("/login")} style={{ marginTop: 12 }}/></Panel> : tickets.length ? tickets.map(ticket => <Panel key={ticket.id} style={styles.ticket}><View style={styles.ticketRow}><Text style={styles.ticketTitle}>{ticket.subject}</Text><Text style={[styles.status, ticket.status === "RESOLVED" ? styles.resolved : null]}>{ticket.status.replaceAll("_", " ")}</Text></View><Text style={styles.ticketCopy}>{ticket.message}</Text><Text style={styles.date}>{new Date(ticket.createdAt).toLocaleString("en-IN")}</Text>{ticket.adminReply ? <View style={styles.reply}><Text style={styles.replyLabel}>AGRI-ONE SUPPORT</Text><Text style={styles.ticketCopy}>{ticket.adminReply}</Text></View> : null}</Panel>) : <Panel><Text style={styles.ticketCopy}>No complaints yet. If you need help, create a ticket above.</Text></Panel>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 32 }, back: { color: colors.green, fontSize: 12, fontWeight: "800" }, title: { marginTop: 12, color: colors.dark, fontSize: 25, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 11, lineHeight: 16 }, contactRow: { marginTop: 18, flexDirection: "row", gap: 10 }, contact: { flex: 1, minHeight: 104, padding: 13, borderRadius: 14, backgroundColor: colors.green, justifyContent: "center" }, contactIcon: { color: "#D6EAB4", fontSize: 20 }, contactTitle: { marginTop: 5, color: colors.white, fontSize: 13, fontWeight: "900" }, contactSub: { marginTop: 3, color: "#DBEEE3", fontSize: 9 }, section: { marginTop: 20, marginBottom: 10, color: colors.dark, fontSize: 16, fontWeight: "900" }, form: { gap: 10 }, fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: .5 }, input: { height: 44, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 9, color: colors.dark }, message: { minHeight: 95, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 9, color: colors.dark }, error: { marginTop: 10, color: colors.red, fontSize: 11, lineHeight: 16 }, ticketHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, refresh: { marginTop: 12, color: colors.green, fontSize: 10, fontWeight: "900" }, ticket: { marginBottom: 10, gap: 8 }, ticketRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, ticketTitle: { flex: 1, color: colors.dark, fontSize: 12, fontWeight: "900" }, status: { color: colors.orange, fontSize: 9, fontWeight: "900" }, resolved: { color: colors.green }, ticketCopy: { color: colors.muted, fontSize: 10, lineHeight: 16 }, date: { color: colors.muted, fontSize: 8 }, reply: { padding: 10, borderRadius: 10, backgroundColor: colors.greenTint }, replyLabel: { marginBottom: 5, color: colors.green, fontSize: 8, fontWeight: "900" },
});
