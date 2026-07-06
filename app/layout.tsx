import type { Metadata } from "next";
import { Suspense } from "react";
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
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <Suspense fallback={null}>
          <GlobalBusyIndicator />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
