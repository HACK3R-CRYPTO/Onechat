import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "OneChat - One Chat. Multiple Superpowers.",
  description: "Ask anything. Get real answers. Execute actions. All in one chat. Built on Cronos with x402 micropayments.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // Get the cookie header string - format as "name=value; name2=value2"
  const cookieHeader = cookieStore.getAll()
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ') || null;
  
  return (
    <html lang="en">
      <body>
        <Providers cookies={cookieHeader}>{children}</Providers>
      </body>
    </html>
  );
}
