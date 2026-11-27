import { AgriText as Text } from "../../components/AgriText";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Brand } from "../../components/Brand";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/theme";

export default function BusinessScreen() {
  const { token, user, organization, loadingSession } = useAppStore();
  if (loadingSession) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.green} /></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Brand />
      <Text style={styles.title}>Your business</Text>
      <Text style={styles.subtitle}>Manage your Agri-One business workspace.</Text>
      {!token || !user ? <View style={styles.panel}>
        <View style={styles.icon}><Text style={styles.glyph}>▱</Text></View>
        <Text style={styles.panelTitle}>Sign in to continue</Text>
        <Text style={styles.copy}>Your business tools and account details are available after you sign in.</Text>
        <Pressable onPress={() => router.push("/login")} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable>
        <Pressable onPress={() => router.push("/register")} style={styles.secondary}><Text style={styles.secondaryText}>Create an account</Text></Pressable>
      </View> : <View style={styles.panel}>
        <View style={styles.icon}><Text style={styles.glyph}>▱</Text></View>
        <Text style={styles.panelTitle}>{organization?.name ?? user.name}</Text>
        <Text style={styles.copy}>{organization?.type ?? user.role} account · {organization?.verificationStatus?.replaceAll("_", " ") ?? "Active"}</Text>
        <Pressable onPress={() => router.push("/workspace")} style={styles.primary}><Text style={styles.primaryText}>Open business workspace</Text></Pressable>
        <Pressable onPress={() => router.push("/(tabs)/account")} style={styles.secondary}><Text style={styles.secondaryText}>View Agri-One profile</Text></Pressable>
      </View>}
      <View style={styles.note}><Text style={styles.noteTitle}>Need a hand?</Text><Text style={styles.noteCopy}>Visit Agri-One FAQs or contact our team for help with your business account.</Text><Pressable onPress={() => router.push("/info/contact")}><Text style={styles.noteLink}>Contact Agri-One  ›</Text></Pressable></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 28 }, title: { marginTop: 25, color: colors.dark, fontSize: 25, fontWeight: "900" }, subtitle: { marginTop: 5, color: colors.muted, fontSize: 12 }, panel: { marginTop: 22, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.white }, icon: { width: 62, height: 62, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint }, glyph: { color: colors.green, fontSize: 30 }, panelTitle: { marginTop: 14, color: colors.dark, fontSize: 17, fontWeight: "900", textAlign: "center" }, copy: { marginTop: 7, marginBottom: 16, color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" }, primary: { width: "100%", minHeight: 45, marginTop: 8, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.green }, primaryText: { color: colors.white, fontSize: 12, fontWeight: "900" }, secondary: { width: "100%", minHeight: 43, marginTop: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.white }, secondaryText: { color: colors.green, fontSize: 11, fontWeight: "800" }, note: { marginTop: 16, padding: 15, borderRadius: 13, backgroundColor: "#EAF6EF" }, noteTitle: { color: colors.dark, fontSize: 12, fontWeight: "900" }, noteCopy: { marginTop: 5, color: colors.muted, fontSize: 10, lineHeight: 15 }, noteLink: { marginTop: 10, color: colors.green, fontSize: 11, fontWeight: "900" } });
