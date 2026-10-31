import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Crivo API | Auditoria de CSV",
  description:
    "Auditoria de CSV com contratos, validação e exportação segura no servidor.",
  metadataBase: new URL("https://crivo-api-gustapaz.starrylinen.chatgpt.site"),
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
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
