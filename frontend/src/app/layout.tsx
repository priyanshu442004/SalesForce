import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { MigrationProvider } from "@/context/MigrationContext";
import Sidebar from "@/component/Sidebar";
import Header from "@/component/Header";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AI Migrate - Salesforce Data Migration Platform",
  description: "Next-generation data cleaning, auto-mapping, and migration engine powered by artificial intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#f8fafc] text-slate-900">
        <MigrationProvider>
          <div className="min-h-screen w-full flex bg-[#f8fafc] select-none font-sans overflow-x-hidden overflow-y-auto lg:overflow-hidden">
            
            {/* Sidebar from src/component/ */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col bg-[#f8fafc] min-h-screen lg:h-screen lg:overflow-hidden w-full">
              
              {/* Header from src/component/ */}
              <Header />

              {/* Page Router Contents */}
              {children}
              
            </main>

          </div>
        </MigrationProvider>
      </body>
    </html>
  );
}
