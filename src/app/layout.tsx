import "./globals.css";
import { Fraunces, Inter } from "next/font/google";
import AppShell from "../components/AppShell";
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
export const metadata = { title: "Ledger — Multi-Cloud Cost & Usage Platform", description: "Monitor billing, usage, budgets, anomalies, commitments and recommendations across AWS, Azure and GCP in one place." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={`${display.variable} ${sans.variable}`}><body><AppShell>{children}</AppShell></body></html>);
}
