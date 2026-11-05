import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "./site-header";

const SITE_URL = "https://www.roadtof1.app";
const SITE_DESCRIPTION =
  "The junior single-seater database — results, career ladders and rankings on the road to Formula 1.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Road to F1",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Road to F1",
    url: "/",
    title: "Road to F1",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
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
