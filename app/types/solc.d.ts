/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'solc' {
  interface ImportCallback {
    (path: string): { contents: string } | { error: string };
  }

  interface CompilerInput {
    language: 'Solidity';
    sources: {
      [key: string]: {
        content: string;
      };
    };
    settings: {
      outputSelection: {
        '*': {
          '*': string[];
        };
      };
      optimizer?: {
        enabled: boolean;
        runs: number;
      };
    };
  }

  interface CompilerOutput {
    contracts: {
      [key: string]: {
        [key: string]: {
          abi: unknown[];
          evm: {
            bytecode: {
              object: string;
            };
          };
        };
      };
    };
    errors?: Array<{
      message: string;
      severity: string;
      type: string;
    }>;
  }

  function compile(input: string, readCallback?: ImportCallback): string;
  
  const solc: {
    compile: (input: string, readCallback?: ImportCallback) => string;
    loadRemoteVersion: (version: string, callback: (err: Error | null, compiler?: any) => void) => void;
  };
  
  export = solc;
} 