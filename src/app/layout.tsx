import "./globals.css";
import AppShell from "../components/AppShell";
export const metadata = { title: "Ledger — Multi-Cloud Cost & Usage Platform", description: "Monitor billing, usage, budgets, anomalies, commitments and recommendations across AWS, Azure and GCP in one place." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><AppShell>{children}</AppShell></body></html>);
}
