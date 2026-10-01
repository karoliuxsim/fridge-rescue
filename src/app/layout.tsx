import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import DeveloperMode from "@/components/DeveloperMode";

export const metadata: Metadata = {
  title: "Fridge Rescue – receptai iš turimų produktų",
  description: "Atraskite, ką gaminti iš turimo ingrediento.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="lt"><body><Header /><DeveloperMode />{children}</body></html>;
}
