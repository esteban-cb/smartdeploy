import { NextResponse } from 'next/server';
import axios from 'axios';

// Update the system prompt for better contract generation
const systemPrompt = `Generate a complete Solidity smart contract with the following requirements:
1. Use Solidity version 0.8.24
2. Use @openzeppelin/contracts v4.9.5 properly:
   - Import and use Ownable for access control
   - Import and use ERC20 for token functionality
   - Import and use ReentrancyGuard for security
3. Constructor must be properly initialized:
   - Initialize ERC20 with name and symbol
   - Initialize Ownable with msg.sender
   - Set forwardingAddress for self-destruct
   Example constructor:
   constructor(
       string memory name_,
       string memory symbol_,
       address forwardingAddress_
   ) ERC20(name_, symbol_) {
       if(forwardingAddress_ == address(0)) revert InvalidAddress();
       forwardingAddress = forwardingAddress_;
   }

4. Include self-destruct capability:
   - Add a function that forwards ETH to a specified address and destroys the contract
   - Only owner can call self-destruct
   - Emit event before destruction
5. For receive() function:
   - Forward ETH to specified address
   - Trigger self-destruct if configured
   - Emit events for tracking
6. Include proper error handling with custom errors:
   error InvalidAddress();
   error InvalidAmount();
   error TransferFailed();
   error SelfDestructNotEnabled();

7. Include events for important state changes:
   event ContractDestroyed(address indexed destroyer, uint256 balance);
   event ETHForwarded(address indexed to, uint256 amount);

Example structure:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error InvalidAddress();
error InvalidAmount();
error TransferFailed();
error SelfDestructNotEnabled();

contract YourToken is ERC20, Ownable, ReentrancyGuard {
    event ContractDestroyed(address indexed destroyer, uint256 balance);
    event ETHForwarded(address indexed to, uint256 amount);

    address public immutable forwardingAddress;
    bool public selfDestructEnabled;

    constructor(
        string memory name_,
        string memory symbol_,
        address forwardingAddress_
    ) ERC20(name_, symbol_) {
        if(forwardingAddress_ == address(0)) revert InvalidAddress();
        forwardingAddress = forwardingAddress_;
    }

    function enableSelfDestruct() external onlyOwner {
        selfDestructEnabled = true;
    }

    function destroyContract() external onlyOwner {
        if(!selfDestructEnabled) revert SelfDestructNotEnabled();
        uint256 balance = address(this).balance;
        emit ContractDestroyed(msg.sender, balance);
        selfdestruct(payable(forwardingAddress));
    }

    receive() external payable {
        if (selfDestructEnabled) {
            uint256 amount = msg.value;
            emit ETHForwarded(forwardingAddress, amount);
            selfdestruct(payable(forwardingAddress));
        }
    }
}`;

// Update type name and usage
type APIErrorResponse = {
  response?: {
    status: number;
    data: unknown;
  };
  message: string;
};

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Add system prompt to guide contract generation
    const enhancedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid input', details: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Call xAI API
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        messages: enhancedMessages,
        model: 'grok-beta',
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`
        }
      }
    );

    // Extract and return the response content
    return NextResponse.json(response.data.choices[0].message);

  } catch (error: APIErrorResponse) {
    console.error('xAI API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Authentication error', details: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (error.response?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', details: 'Too many requests' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to process request', 
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 