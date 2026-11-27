import { forwardRef, isValidElement, type ReactNode } from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type Text as NativeTextInstance,
  type TextInput as NativeTextInputInstance,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { colors } from "../src/theme";
import { typography, typographyVariantForSize, type TypographyVariant } from "../src/typography";

function containsBengali(value: ReactNode): boolean {
  if (typeof value === "string") return /[\u0980-\u09FF]/.test(value);
  if (Array.isArray(value)) return value.some(containsBengali);
  if (isValidElement<{ children?: ReactNode }>(value)) return containsBengali(value.props.children);
  return false;
}

function weightValue(value: TextStyle["fontWeight"]): number {
  if (value === "bold") return 700;
  if (value === "normal" || value === undefined) return 400;
  return Number(value);
}

function fontFamily(weight: TextStyle["fontWeight"], bengali: boolean) {
  const value = weightValue(weight);
  if (bengali) return value >= 600 ? typography.fontFamilies.bengali.bold : typography.fontFamilies.bengali.regular;
  return typography.fontFamilies.english;
}

function normalizedNeutralColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^#([0-9a-f]{6})$/i);
  if (!match) return undefined;
  const channels = match[1].match(/../g)?.map(channel => parseInt(channel, 16));
  if (!channels) return undefined;
  const [red, green, blue] = channels;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (spread > 24 || Math.min(red, green, blue) >= 185) return undefined;
  const brightness = (red + green + blue) / 3;
  return brightness < 110 ? typography.colors.primary : typography.colors.secondary;
}

function textContent(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(value)) return textContent(value.props.children);
  return "";
}

function isImportantNumber(value: ReactNode): boolean {
  return /^[₹$€£]?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:%|₹|kg|g|l|ml|pcs?)?$/i.test(textContent(value).trim());
}

function textStyle(style: StyleProp<TextStyle>, children: ReactNode, variant?: TypographyVariant) {
  const flattened = StyleSheet.flatten(style);
  const adjustedColor = normalizedNeutralColor(flattened?.color);
  const sourceSize = typeof flattened?.fontSize === "number" ? flattened.fontSize : undefined;
  const isDecorativeNumber = sourceSize !== undefined && sourceSize >= 40 && isImportantNumber(children);
  const role = variant ?? typographyVariantForSize(sourceSize);
  const roleStyle = typography.variants[role];
  const sourceWeight = weightValue(flattened?.fontWeight);
  const fontWeight: TextStyle["fontWeight"] = isImportantNumber(children)
    ? "700"
    : role === "brand" ? "800"
    : role === "mainHeading" ? "700"
    : role === "sectionHeading" ? "600"
    : role === "cardTitle" ? (sourceWeight >= 600 ? "600" : "500")
    : role === "price" ? "700"
    : sourceWeight >= 600 ? "500"
    : sourceWeight >= 500 ? "500" : "400";
  const bengali = containsBengali(children);
  const lineHeight = roleStyle.lineHeight + (bengali ? 2 : 0);
  return [style, {
    color: adjustedColor ?? flattened?.color ?? typography.colors.primary,
    fontFamily: fontFamily(fontWeight, bengali),
    fontSize: isDecorativeNumber ? sourceSize : roleStyle.fontSize,
    fontWeight,
    lineHeight: isDecorativeNumber ? (flattened?.lineHeight ?? Math.round((sourceSize ?? 40) * 1.15)) : lineHeight,
    letterSpacing: isDecorativeNumber ? (flattened?.letterSpacing ?? 0) : roleStyle.letterSpacing,
  } satisfies TextStyle];
}

type AgriTextProps = TextProps & { variant?: TypographyVariant };

export const AgriText = forwardRef<NativeTextInstance, AgriTextProps>(function AgriText({ children, style, variant, ...props }, ref) {
  return <NativeText ref={ref} {...props} style={textStyle(style, children, variant)}>{children}</NativeText>;
});

export const AgriTextInput = forwardRef<NativeTextInputInstance, TextInputProps>(function AgriTextInput({ style, placeholderTextColor, ...props }, ref) {
  const inputText = [props.value, props.defaultValue, props.placeholder].filter(value => value !== undefined).join(" ");
  return <NativeTextInput
    ref={ref}
    {...props}
    placeholderTextColor={normalizedNeutralColor(placeholderTextColor) ?? placeholderTextColor ?? colors.muted}
    style={textStyle(style, inputText)}
  />;
});
