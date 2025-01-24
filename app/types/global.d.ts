declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
      isConnected?: () => boolean;
      selectedAddress?: string;
      networkVersion?: string;
      chainId?: string;
      // Add properties needed by ethers.js
      enable: () => Promise<string[]>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export {}; 