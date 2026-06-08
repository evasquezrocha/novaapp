import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaApp",
  description: "Panel de aplicación con login y menú lateral",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
