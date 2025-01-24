import '@coinbase/onchainkit/styles.css';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Smart Contract Generator',
  description: 'Generate and deploy smart contracts on Base using AI',
  openGraph: {
    title: 'Smart Contract Generator',
    description: 'Generate and deploy smart contracts on Base using AI',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background dark">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
