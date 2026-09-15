import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finquo — Find the focus in every conversation",
  description: "Record or upload a mentorship session and turn its main topics into a clear, downloadable word cloud.",
  other: { "x-brief-ref": "TFG-WD-8823" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
