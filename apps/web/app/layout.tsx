import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "APBling — Inteligência operacional para o Bling",
    template: "%s — APBling",
  },
  description:
    "Transforme notas, custos, integrações e margem em uma operação clara, segura e multiempresa.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
