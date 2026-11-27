import { Platform, type TextStyle } from "react-native";

export const typography = {
  fontFamilies: {
    english: Platform.select({
      android: "Roboto",
      ios: "System",
      web: "Roboto, Arial, sans-serif",
      default: "Roboto",
    }) ?? "Roboto",
    bengali: {
      regular: "NotoSansBengaliRegular",
      bold: "NotoSansBengaliBold",
    },
  },
  colors: {
    primary: "#1F2937",
    secondary: "#6B7280",
  },
  variants: {
    brand: { fontSize: 32, fontWeight: "800", lineHeight: 38, letterSpacing: -0.35 },
    mainHeading: { fontSize: 24, fontWeight: "700", lineHeight: 30, letterSpacing: -0.25 },
    sectionHeading: { fontSize: 18, fontWeight: "600", lineHeight: 25, letterSpacing: -0.1 },
    cardTitle: { fontSize: 16, fontWeight: "600", lineHeight: 23, letterSpacing: 0 },
    body: { fontSize: 14, fontWeight: "400", lineHeight: 21, letterSpacing: 0 },
    label: { fontSize: 12, fontWeight: "400", lineHeight: 18, letterSpacing: 0.1 },
    price: { fontSize: 16, fontWeight: "700", lineHeight: 22, letterSpacing: 0 },
  } satisfies Record<string, TextStyle>,
} as const;

export type TypographyVariant = keyof typeof typography.variants;

export function typographyVariantForSize(fontSize: number | undefined): TypographyVariant {
  if (fontSize === undefined) return "body";
  if (fontSize >= 22) return "mainHeading";
  if (fontSize >= 18) return "sectionHeading";
  if (fontSize >= 15) return "cardTitle";
  if (fontSize >= 13) return "body";
  return "label";
}
