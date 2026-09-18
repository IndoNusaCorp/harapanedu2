import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "../globals.css";
import { RoleProvider } from "@/context/RoleContext";
import { ThemeProvider } from "@/components/layout";
import { I18nProviderClient } from "@/components/translate/client";
import idDictionary from "@/components/translate/id";
import enDictionary from "@/components/translate/en";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { meta } = locale === "en" ? enDictionary : idDictionary;
  return { title: meta.title, description: meta.description };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full flex overflow-hidden bg-[#F1F5FF] dark:bg-edu-navy text-slate-900 dark:text-slate-100 font-sans selection:bg-edu-blue/30">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProviderClient locale={locale}>
            <RoleProvider>
              <div className="relative z-10 flex h-full w-full">
                {children}
              </div>
            </RoleProvider>
          </I18nProviderClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
