import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "./site-header";

export const metadata: Metadata = {
  title: "Road to F1",
  description:
    "The junior single-seater database — results, career ladders and rankings on the road to Formula 1.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
