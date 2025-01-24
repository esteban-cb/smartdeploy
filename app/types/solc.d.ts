declare module 'solc' {
  interface ImportCallback {
    import: (path: string) => { contents: string } | { error: string };
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
          abi: any[];
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

  interface Compiler {
    compile: (input: string, callback?: ImportCallback) => string;
  }

  const solc: {
    compile: (input: string, callback?: ImportCallback) => string;
    loadRemoteVersion: (version: string, callback: (err: Error | null, compiler?: Compiler) => void) => void;
  };

  export default solc;
} 