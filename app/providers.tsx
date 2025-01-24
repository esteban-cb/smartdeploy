'use client';

import { baseSepolia } from 'viem/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import type { ReactNode } from 'react';

// Double check the chain ID is correct
console.log('Base Sepolia Chain ID:', baseSepolia.id); // Should be 84532

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={baseSepolia}
      config={{
        appearance: {
          name: "SmartDeploy",
          mode: "dark",
          theme: "base"
        },
        wallet: {
          display: 'modal'
        }
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}

