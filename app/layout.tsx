import type { Metadata } from "next";
import "./globals.css";
import "./agri.css";

export const metadata: Metadata = {
  title: "Agri-One | Smart Farming Solutions",
  description:
    "Shop trusted agricultural products, grow your business, and find support for every season with Agri-One.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
