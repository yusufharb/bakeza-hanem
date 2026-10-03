import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بكيزة هانم | إدارة الأعمال المتكاملة",
  description: "نظام إدارة المبيعات، المخزون، المشتريات، الخزينة، والمحفظة لمتجر بكيزة هانم",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-ink min-h-screen selection:bg-accent-soft selection:text-accent-dark">
        {children}
      </body>
    </html>
  );
}
