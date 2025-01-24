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
const findImports = (path: string) => {
  if (path.startsWith('@openzeppelin/')) {
    const contents = findOpenZeppelinContract(path);
    if (contents) {
      return { contents };
    }
  }
  return { error: `File not found: ${path}` };
};

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    const input = {
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
      solc.compile(JSON.stringify(input), findImports)
    );

    if (output.errors?.some((error: { severity: string }) => error.severity === 'error')) {
      const errorMessage = output.errors
        ?.filter((error: { severity: string; message: string }) => error.severity === 'error')
        .map((error: { message: string }) => error.message)
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