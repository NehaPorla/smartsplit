import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'SmartSplit · Shared expenses made simple', description: 'Know who owes whom, and what to pay or receive.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><head><meta charSet="utf-8" /></head><body>{children}</body></html>; }
