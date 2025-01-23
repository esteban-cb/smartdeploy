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
const findAllImports = (importPath: string) => {
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

interface ConstructorInput {
  name: string;
  type: string;
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    // Create compiler input with remappings
    const input = {
      language: 'Solidity',
      sources: {
        'contract.sol': {
          content: code
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['*']
          }
        },
        evmVersion: 'paris'
      }
    };

    // Use synchronous compilation
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findAllImports }));

    // Check for errors
    if (output.errors) {
      const errors = output.errors.filter((error: CompilerError) => error.severity === 'error');
      if (errors.length > 0) {
        return NextResponse.json({ 
          error: 'Compilation failed', 
          details: errors.map((e: CompilerError) => e.formattedMessage).join('\n') 
        }, { status: 400 });
      }
    }

    // Get the contract
    const contractFile = output.contracts['contract.sol'];
    if (!contractFile || Object.keys(contractFile).length === 0) {
      return NextResponse.json({ 
        error: 'Compilation failed', 
        details: 'No contract found in source' 
      }, { status: 400 });
    }

    const contractName = Object.keys(contractFile)[0];
    const contract = contractFile[contractName];

    // Get constructor inputs from ABI
    const constructorAbi = contract.abi.find((item: { type: string }) => item.type === 'constructor');
    const constructorInputs = constructorAbi ? constructorAbi.inputs : [];

    return NextResponse.json({
      name: contractName,
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
      constructorInputs // Return constructor input types for frontend validation
    });
  } catch (error: APIError) {
    console.error('Compilation error:', error);
    return NextResponse.json({ 
      error: 'Compilation failed', 
      details: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
} 