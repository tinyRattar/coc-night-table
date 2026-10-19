import type { Metadata } from "next";
import "./globals.css";
import "./keeper.css";
import "./activity-tabs.css";
import "./combat.css";
import "./materials.css";
import "./identity.css";
import "./workspace-refresh.css";
import "./vitals.css";

export const metadata: Metadata = {
  title: "秘典 · CoC 调查员大厅",
  description: "CoC 第七版人物卡与多人共享检定桌",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}



