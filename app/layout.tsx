import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Gravitas_One, Libre_Baskerville, Montserrat } from "next/font/google";
import "./globals.css";

const gravitas = Gravitas_One({
  variable: "--font-gravitas",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

const libre = Libre_Baskerville({
  variable: "--font-libre",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Motif.",
  description: "Your personal reflection companion",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
      <html lang="en">
        <body className={`${gravitas.variable} ${libre.variable} ${montserrat.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
