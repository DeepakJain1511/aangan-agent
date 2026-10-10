import type { ReactNode } from "react";

export const metadata = { title: "Aangan Studio: Phone Enquiry Agent" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#faf8f5", color: "#222" }}>{children}</body>
    </html>
  );
}
