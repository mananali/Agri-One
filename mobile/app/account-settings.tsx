import { AgriText as Text } from "../components/AgriText";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "../src/theme";

const REMINDERS_KEY = "agri-one-settings-order-reminders";
const UPDATES_KEY = "agri-one-settings-product-updates";

export default function AccountSettingsScreen() {
  const [orderReminders, setOrderReminders] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(REMINDERS_KEY), AsyncStorage.getItem(UPDATES_KEY)]).then(([reminders, updates]) => {
      if (reminders !== null) setOrderReminders(reminders === "true");
      if (updates !== null) setProductUpdates(updates === "true");
    }).finally(() => setLoaded(true));
  }, []);
  const save = (key: string, value: boolean, update: (value: boolean) => void) => {
    update(value);
    void AsyncStorage.setItem(key, String(value));
  };
  if (!loaded) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.green} /></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>App Settings</Text><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.card}>
        <View style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>Order reminders</Text><Text style={styles.rowHint}>Keep this preference saved on this device.</Text></View><Switch value={orderReminders} onValueChange={value => save(REMINDERS_KEY, value, setOrderReminders)} trackColor={{ false: "#CDD4CE", true: "#8CC3A5" }} thumbColor={orderReminders ? colors.green : "#F5F7F5"} /></View>
        <View style={styles.divider} />
        <View style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>Product updates</Text><Text style={styles.rowHint}>Keep this preference saved on this device.</Text></View><Switch value={productUpdates} onValueChange={value => save(UPDATES_KEY, value, setProductUpdates)} trackColor={{ false: "#CDD4CE", true: "#8CC3A5" }} thumbColor={productUpdates ? colors.green : "#F5F7F5"} /></View>
      </View>
      <Text style={styles.disclaimer}>Push notifications are not connected yet. These preferences are stored locally on this device.</Text>
      <Pressable onPress={() => router.push("/info/privacy")} style={styles.linkRow}><Text style={styles.rowTitle}>Privacy policy</Text><Text style={styles.chevron}>›</Text></Pressable>
      <Pressable onPress={() => router.push("/info/terms")} style={styles.linkRow}><Text style={styles.rowTitle}>Terms of service</Text><Text style={styles.chevron}>›</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, header: { height: 57, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white }, back: { width: 30, color: colors.dark, fontSize: 35, lineHeight: 38 }, headerTitle: { color: colors.dark, fontSize: 16, fontWeight: "900" }, spacer: { width: 30 }, content: { padding: 18 }, sectionTitle: { marginBottom: 10, color: colors.dark, fontSize: 16, fontWeight: "900" }, card: { overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white }, row: { minHeight: 72, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }, copy: { flex: 1, paddingRight: 10 }, rowTitle: { color: colors.dark, fontSize: 12, fontWeight: "800" }, rowHint: { marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: 14 }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 14, backgroundColor: colors.line }, disclaimer: { marginTop: 10, color: colors.muted, fontSize: 10, lineHeight: 16 }, linkRow: { minHeight: 49, marginTop: 9, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white }, chevron: { color: colors.muted, fontSize: 23 } });
