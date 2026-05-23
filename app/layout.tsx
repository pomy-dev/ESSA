import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "ESSA Sports Management System",
  description: "Eswatini Schools Association - Sports Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
