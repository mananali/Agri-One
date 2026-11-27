import { AgriText as Text } from "../../components/AgriText";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "../../components/Brand";
import { Button, Panel } from "../../components/Controls";
import { colors } from "../../src/theme";

const pages: Record<string, { title: string; intro: string; points: string[] }> = {
  about: { title: "A clearer way to source agricultural inputs", intro: "Agri-One connects agricultural retailers with product suppliers and Agri-One wholesale stock, with a local-first focus on North Bengal.", points: ["Discover products across multiple categories", "See seller and stock-source details", "Built for businesses in Cooch Behar and Alipurduar"] },
  services: { title: "Services for agriculture businesses", intro: "Tools for retailers, suppliers and the people who keep orders moving.", points: ["Wholesale product discovery", "Supplier listing and onboarding", "Retailer catalogue and order workspace", "Local delivery operations"] },
  retailers: { title: "Stock your shop with confidence", intro: "Compare product details, pack sizes, wholesale prices and minimum order quantities in one catalogue.", points: ["Browse by category and brand", "Save products to your cart", "Manage orders from your phone"] },
  suppliers: { title: "Grow your reach with Agri-One", intro: "Introduce your company and products to agricultural retailers through a dedicated seller workspace.", points: ["Submit product listings for review", "Update available stock", "Review and respond to orders"] },
  contact: { title: "Talk to the Agri-One team", intro: "Reach out about retailer and supplier onboarding in North Bengal.", points: ["Cooch Behar, West Bengal", "Alipurduar, West Bengal", "Retailer and supplier enquiries"] },
  faq: { title: "Frequently asked questions", intro: "A few things to know about Agri-One.", points: ["Are these sample prices? When the API is offline, sample catalogue prices are shown.", "Can I place an order? Checkout requires a verified retailer account and a working API.", "Can suppliers sign in? Yes. Supplier accounts can be created and used with the backend.", "Where is Agri-One serving? The initial focus is North Bengal."] },
  privacy: { title: "Privacy", intro: "Agri-One stores account and order data in its backend when you sign in and use connected services.", points: ["Session tokens are stored using the platform's secure storage where available.", "Avoid adding sensitive information that the application does not request.", "Contact the Agri-One team with privacy questions."] },
  terms: { title: "Terms and conditions", intro: "Catalogue availability, seller eligibility, and order terms are confirmed by the live service at checkout.", points: ["Sample catalogue data is for preview only.", "An order is created only after backend confirmation.", "Commercial and supply terms may vary by seller and product."] },
};

export default function InfoScreen() {
  const { slug = "about" } = useLocalSearchParams<{ slug: string }>();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const page = pages[slug] ?? pages.about;
  const faqItems = slug === "faq" ? page.points : [];
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.content}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  Back</Text></Pressable><Brand/><Text style={styles.kicker}>AGRI-ONE  /  {slug.replaceAll("-", " ").toUpperCase()}</Text><Text style={styles.title}>{page.title}</Text><Text style={styles.intro}>{page.intro}</Text>
    {faqItems.length ? faqItems.map((item, index) => <Pressable key={item} onPress={() => setOpenFaq(openFaq === index ? null : index)}><Panel style={styles.item}><View style={styles.faqRow}><Text style={styles.itemText}>{item.split("?")[0]}?</Text><Text style={styles.plus}>{openFaq === index ? "−" : "+"}</Text></View>{openFaq === index && <Text style={styles.faqAnswer}>{item.split("?").slice(1).join("?").trim()}</Text>}</Panel></Pressable>) : page.points.map((item, index) => <Panel key={item} style={styles.item}><Text style={styles.number}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.itemText}>{item}</Text></Panel>)}
    {slug === "contact" && <Panel style={styles.contact}><Text style={styles.contactTitle}>Talk to the Agri-One team</Text><Text style={styles.intro}>Balarampur Bazar · Cooch Behar, West Bengal</Text><Button title="Call +91 99333 29102" onPress={() => void Linking.openURL("tel:+919933329102")}/><Button title="Email support@agri-one.in" variant="outline" onPress={() => void Linking.openURL("mailto:support@agri-one.in?subject=Agri-One%20enquiry")}/></Panel>}
    {(slug === "retailers" || slug === "suppliers") && <Button title={slug === "retailers" ? "Browse products" : "Create a supplier account"} onPress={() => router.push(slug === "retailers" ? "/(tabs)" : "/register")}/>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 34 }, back: { alignSelf: "flex-start", paddingVertical: 8 }, backText: { color: colors.green, fontSize: 13, fontWeight: "700" }, kicker: { marginTop: 26, color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { marginTop: 9, color: colors.dark, fontSize: 26, lineHeight: 33, fontWeight: "900" }, intro: { marginTop: 9, marginBottom: 18, color: colors.muted, fontSize: 13, lineHeight: 20 }, item: { marginBottom: 9, flexDirection: "row", alignItems: "flex-start", gap: 11 }, number: { color: colors.green, fontWeight: "900", fontSize: 11 }, itemText: { flex: 1, color: colors.dark, fontSize: 12, lineHeight: 18, fontWeight: "600" }, faqRow: { flexDirection: "row", alignItems: "center", flex: 1 }, plus: { color: colors.green, fontSize: 19, fontWeight: "800" }, faqAnswer: { marginTop: 8, color: colors.muted, fontSize: 12, lineHeight: 18 }, contact: { marginTop: 18, gap: 6 }, contactTitle: { color: colors.dark, fontSize: 15, fontWeight: "800" } });
