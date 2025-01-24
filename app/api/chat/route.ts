import { NextResponse } from 'next/server';
import axios from 'axios';

// Update the system prompt for better contract generation
const systemPrompt = `Generate a complete Solidity smart contract based on the user's description.
Use Solidity version 0.8.24 and @openzeppelin/contracts v4.9.5.

Important contract requirements:
1. Use proper imports:
   import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
   import "@openzeppelin/contracts/access/Ownable.sol";
   import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

2. For ERC20 tokens, use this constructor pattern EXACTLY:
   constructor() ERC20("TokenName", "SYMBOL") Ownable() {
     // initialization code
   }

3. For non-ERC20 contracts that need Ownable, use this pattern:
   constructor() Ownable() {
     // initialization code
   }

4. Variable types must be exact:
   - Use uint256 for all number variables (not uint20, uint, etc.)
   - Use address for wallet addresses
   - Use bool for boolean values
   - Use string for text

5. For ETH balance operations:
   uint256 balance = address(this).balance;  // Always use uint256 for balance

6. Include these for all contracts:
   - Custom error declarations at the top
   - Event declarations after errors
   - Clear comments for functions
   - Proper access control modifiers
   - Use 18 decimals for token amounts (1 token = 1e18)

IMPORTANT NOTES:
- Always call Ownable() in constructor when inheriting
- Always use uint256 for numbers
- Always check for integer overflow
- Include proper events for all state changes
- Use require or custom errors for validation`;

interface APIErrorResponse {
  response?: {
    status: number;
    data: unknown;
  };
  message: string;
}

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
          'Authorization': 'Bearer ' + process.env.XAI_API_KEY
        }
      }
    );

    // Extract and return the response content
    return NextResponse.json(response.data.choices[0].message);

  } catch (error) {
    const err = error as APIErrorResponse;
    console.error('xAI API Error:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      return NextResponse.json(
        { error: 'Authentication error', details: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (err.response?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', details: 'Too many requests' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to process request', 
        details: err.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 