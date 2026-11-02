import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai_Looped, Nunito } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { ServiceWorkerRegister } from "@/components/providers/ServiceWorkerRegister";
import { SoundUnlock } from "@/components/providers/SoundUnlock";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const thai = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "24/7",
  description: "1 day = 24 hours = 7 blocks. A day planner that grows a cozy farm.",
  applicationName: "24/7",
  appleWebApp: { capable: true, title: "24/7", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#22201c" },
  ],
};

/** Applies saved language/theme before first paint to avoid a flash. */
const PREFS_BOOT = `try{var p=JSON.parse(localStorage.getItem('247-prefs')||'{}').state||{};if(p.locale)document.documentElement.lang=p.locale;if(p.theme&&p.theme!=='system')document.documentElement.setAttribute('data-theme',p.theme)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${thai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
      </head>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerRegister />
        <SoundUnlock />
      </body>
    </html>
  );
}
