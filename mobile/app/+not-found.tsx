import { AgriText as Text } from "../components/AgriText";
import { router, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "../components/Brand";
import { Button } from "../components/Controls";
import { colors } from "../src/theme";

export default function NotFoundScreen() {
  return <>
    <Stack.Screen options={{ title: "Agri-One" }} />
    <SafeAreaView style={styles.container}>
      <Brand />
      <View style={styles.copy}><Text style={styles.title}>We couldn't find that page</Text><Text style={styles.detail}>Return to the Agri-One shop and keep browsing.</Text></View>
      <Button title="Back to shop" onPress={() => router.replace("/(tabs)")} />
    </SafeAreaView>
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.canvas },
  copy: { marginTop: 36, marginBottom: 18 },
  title: { color: colors.dark, fontSize: 23, fontWeight: "900" },
  detail: { marginTop: 8, color: colors.muted, fontSize: 13, lineHeight: 19 },
});
