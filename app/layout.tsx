import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "토론방 예약 시스템",
  description: "토론방 예약 시스템입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
