import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISNA Platform V2",
  description: "Plateforme SaaS live et vidéo indépendante.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
