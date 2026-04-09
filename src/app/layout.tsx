import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Statium — Análise Estatística Online",
  description:
    "Realize ANOVA, Tukey HSD e Scott-Knott diretamente no navegador. A ferramenta moderna e gratuita para análise de experimentos. Sem instalação.",
  keywords: [
    "análise estatística",
    "ANOVA",
    "Tukey",
    "Scott-Knott",
    "DIC",
    "DBC",
    "estatística experimental",
    "SISVAR online",
  ],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
