import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "./providers";

export const metadata: Metadata = {
  title: "Houseworks",
  description: "Project management for post-production teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
