import type { Metadata } from "next";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { GlobalBusyIndicator } from "@/components/global-busy-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaApp",
  description: "Panel de aplicación con login y menú lateral",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureDatabaseSchema();

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <GlobalBusyIndicator />
        {children}
      </body>
    </html>
  );
}
