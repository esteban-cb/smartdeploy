'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { baseSepolia } from 'viem/chains';
import type { ReactNode } from 'react';

// Double check the chain ID is correct
console.log('Base Sepolia Chain ID:', baseSepolia.id); // Should be 84532

export function Providers(props: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={baseSepolia}
      projectId={process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME}
      config={{ 
        appearance: { 
          name: 'Smart Contract Generator',
          mode: 'auto',
          theme: 'default',
        },
        wallet: {
          display: 'modal',
          defaultConnect: true,
          defaultChain: baseSepolia,
          enforceDefaultChain: true,
          supportedChains: [baseSepolia],
          walletConnectVersion: 2
        }
      }}
    >
      {props.children}
    </OnchainKitProvider>
  );
}

