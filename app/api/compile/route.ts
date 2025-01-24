import { NextResponse } from 'next/server';
import solc from 'solc';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Helper function to find OpenZeppelin contracts
const findOpenZeppelinContract = (path: string): string | null => {
  try {
    const normalizedPath = path.replace('@openzeppelin/contracts/', '');
    const fullPath = resolve(process.cwd(), 'node_modules', '@openzeppelin', 'contracts', normalizedPath);
    return readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`Error reading OpenZeppelin contract: ${path}`, error);
    return null;
  }
};

// Helper to get all imported files
const findImports = (importPath: string): { contents: string } | { error: string } => {
  if (importPath.startsWith('@openzeppelin/')) {
    const contents = findOpenZeppelinContract(importPath);
    if (contents) {
      return { contents };
    }
  }
  return { error: `File not found: ${importPath}` };
};

interface CompilerError {
  severity: string;
  formattedMessage: string;
}

interface CompilerErrorResponse {
  response?: {
    status: number;
    data: unknown;
  };
  message: string;
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    const input: solc.CompilerInput = {
      language: 'Solidity',
      sources: {
        'contract.sol': {
          content: code
        }
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode']
          }
        },
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    };

    const output = JSON.parse(
      solc.compile(JSON.stringify(input), { import: findImports })
    ) as solc.CompilerOutput;

    if (output.errors?.some(error => error.severity === 'error')) {
      const errorMessage = output.errors
        .filter(error => error.severity === 'error')
        .map(error => error.message)
        .join('\n');

      return NextResponse.json(
        { error: 'Compilation error', details: errorMessage },
        { status: 400 }
      );
    }

    const contractFile = Object.keys(output.contracts['contract.sol'])[0];
    const contract = output.contracts['contract.sol'][contractFile];

    return NextResponse.json({
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
      name: contractFile
    });

  } catch (error) {
    console.error('Compilation error:', error);
    return NextResponse.json(
      { error: 'Failed to compile contract', details: (error as Error).message },
      { status: 500 }
    );
  }
} 