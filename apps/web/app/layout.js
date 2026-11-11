import { Montserrat, Open_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-montserrat",
});
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-open-sans",
});

export const metadata = {
  title: "Practise360 — NULogic",
  description: "NULogic internal portal for practices, certifications and AI initiatives",
  icons: { icon: "/brand/nulogic-g-icon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${openSans.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
