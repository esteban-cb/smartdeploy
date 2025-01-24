declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
      isConnected?: () => boolean;
      selectedAddress?: string;
      networkVersion?: string;
      chainId?: string;
      // Add properties needed by ethers.js
      enable: () => Promise<string[]>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export {}; 