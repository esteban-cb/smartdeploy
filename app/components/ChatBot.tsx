'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { 
  WalletIsland,
  WalletAdvancedWalletActions,
  WalletAdvancedAddressDetails,
  WalletAdvancedTransactionActions,
  WalletAdvancedTokenHoldings
} from '@coinbase/onchainkit/wallet';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ethers } from 'ethers';
import Draggable from 'react-draggable';
import { FloatingLogos } from './FloatingLogos';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContractData {
  network: 'base-mainnet' | 'base-sepolia' | null;
  ownerAddress: string | null;
  contractType: string | null;
  contractCode: string | null;
}

const CONTRACT_SUGGESTIONS = [
  'ERC20 Token',
  'ERC721 NFT',
  'Custom Token with Governance',
  'Multi-signature Wallet',
  'Staking Contract',
  'DAO Contract',
];

// Update the Toast component with a more playful design
const Toast = ({ message, type = 'error', onClose }: { message: string; type?: 'error' | 'success'; onClose: () => void }) => (
  <div className={`fixed bottom-4 right-4 p-4 rounded-2xl backdrop-blur-md shadow-2xl 
    border border-opacity-30 animate-slide-up
    ${type === 'error' 
      ? 'bg-red-500/70 border-red-400 shadow-red-500/20' 
      : 'bg-green-500/70 border-green-400 shadow-green-500/20'
    }`}>
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium text-white ${type === 'error' ? 'animate-subtle-pulse' : ''}`}>
        {message}
      </span>
      <button 
        onClick={onClose} 
        className="w-6 h-6 flex items-center justify-center rounded-full 
          bg-white/10 hover:bg-white/20 transition-all duration-200"
      >
        ×
      </button>
    </div>
  </div>
);

const extractSolidityCode = (content: string): string => {
  // Look for code between ```solidity and ``` markers
  const matches = content.match(/```solidity\n([\s\S]*?)```/);
  if (matches && matches[1]) {
    return matches[1].trim();
  }
  return content;
};

// Add this new component for the network selection buttons
const NetworkButtons = ({ onSelect }: { onSelect: (network: 'base-mainnet' | 'base-sepolia') => void }) => (
  <div className="flex flex-col sm:flex-row gap-3 mt-4">
    {(['base-mainnet', 'base-sepolia'] as const).map((network) => (
      <button
        key={network}
        onClick={() => onSelect(network)}
        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 
          text-white rounded-xl font-semibold
          hover:shadow-lg hover:shadow-blue-500/25 
          transform hover:scale-[1.02] active:scale-[0.98]
          transition-all duration-200
          border border-blue-500/20 backdrop-blur-xl
          relative overflow-hidden group flex-1"
      >
        <span className="relative z-10 group-hover:text-white/90">
          {network}
        </span>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/0 via-blue-500/40 to-blue-600/0 
          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
        </div>
      </button>
    ))}
  </div>
);

// Add proper type for error handling
interface APIError {
  message: string;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contractData, setContractData] = useState<ContractData>({
    network: null,
    ownerAddress: null,
    contractType: null,
    contractCode: null,
  });
  const [step, setStep] = useState<'network' | 'owner' | 'type' | 'review' | 'deploy'>('network');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Add auto-scroll functionality
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initialPrompt = async () => {
    const assistantMessage: Message = {
      role: 'assistant',
      content: 'Which network would you like to deploy to?'
    };
    setMessages([assistantMessage]);
  };

  // Initialize the chat with the network question
  useState(() => {
    initialPrompt();
  });

  const handleNetworkSelection = (input: string) => {
    const network = input.toLowerCase();
    if (network === 'base-mainnet' || network === 'base-sepolia') {
      setContractData(prev => ({ ...prev, network: network as 'base-mainnet' | 'base-sepolia' }));
      setStep('owner');
      return true;
    }
    return false;
  };

  const handleOwnerAddress = (input: string) => {
    if (ethers.isAddress(input)) {
      setContractData(prev => ({ ...prev, ownerAddress: input }));
      setStep('type');
      return true;
    }
    return false;
  };

  const handleContractTypeInput = async (input: string) => {
    if (input.toLowerCase() === 'custom') {
      setContractData(prev => ({ ...prev, contractType: 'Custom' }));
      return {
        isValid: true,
        message: `Please describe the type of contract you want to create. Here are some suggestions:\n\n${CONTRACT_SUGGESTIONS.map(s => `- ${s}`).join('\n')}\n\nPlease provide specific details about functionality, access controls, and any special features you need.`
      };
    }

    // For custom contract description, don't update the type
    if (contractData.contractType === 'Custom') {
      // Generate contract based on description
      const response = await axios.post('/api/chat', {
        messages: [
          {
            role: 'system',
            content: `Generate a Solidity smart contract based on this description: ${input}`
          }
        ]
      });
      
      const contractCode = response.data.content;
      setContractData(prev => ({ ...prev, contractCode }));
      setStep('review');
      return {
        isValid: true,
        message: 'Here is your contract for review:\n\n```solidity\n' + contractCode + '\n```\n\nWould you like to deploy this contract? Make sure you have enough funds to cover the deployment gas fees.'
      };
    }

    // For non-custom types, set the contract type normally
    setContractData(prev => ({ ...prev, contractType: input }));
    return { isValid: true, message: null };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let nextAssistantMessage: Message;

      switch (step) {
        case 'network':
          if (handleNetworkSelection(input)) {
            nextAssistantMessage = {
              role: 'assistant',
              content: 'Great! Now, please enter your wallet address that will be the owner of the contract.'
            };
          } else {
            nextAssistantMessage = {
              role: 'assistant',
              content: 'Please enter either "base-mainnet" or "base-sepolia" as the network.'
            };
          }
          break;

        case 'owner':
          if (handleOwnerAddress(input)) {
            nextAssistantMessage = {
              role: 'assistant',
              content: `What type of contract would you like to create? You can choose from:\n\n${
                CONTRACT_SUGGESTIONS.map(s => `- ${s}`).join('\n')
              }\n\nOr type "custom" for a custom contract.`
            };
          } else {
            nextAssistantMessage = {
              role: 'assistant',
              content: 'Please enter a valid Ethereum address.'
            };
          }
          break;

        case 'type':
          const result = await handleContractTypeInput(input);
          if (result.isValid) {
            setContractData(prev => ({ ...prev, contractType: input }));
            
            if (result.message) {
              nextAssistantMessage = {
                role: 'assistant',
                content: result.message
              };
            } else {
              // Generate contract based on type
              const response = await axios.post('/api/chat', {
                messages: [
                  ...messages,
                  userMessage,
                  {
                    role: 'system',
                    content: `Generate a simple Solidity smart contract of type ${input}. 
                    Requirements:
                    1. Use Solidity version 0.8.24
                    2. Use @openzeppelin/contracts v4.9.5 imports
                    3. For Ownable contracts, use 'Ownable()' constructor without parameters
                    4. For time-based operations, use block.timestamp
                    5. For ERC20/ERC721:
                       - Use standard constructor with name and symbol parameters
                       - Example: constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
                    6. Keep the contract simple and focused on core functionality
                    7. Use standard Solidity syntax (no experimental features)
                    8. For receive() functions, only use msg.value checks
                    9. Use events for important state changes
                    10. Follow OpenZeppelin patterns

                    Example format:
                    // SPDX-License-Identifier: MIT
                    pragma solidity ^0.8.24;

                    import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
                    import "@openzeppelin/contracts/access/Ownable.sol";

                    contract MyToken is ERC20, Ownable {
                        event Received(address indexed sender, uint256 amount);

                        constructor(string memory name, string memory symbol) 
                            ERC20(name, symbol) 
                            Ownable()
                        {}

                        receive() external payable {
                            emit Received(msg.sender, msg.value);
                        }

                        function mint(address to, uint256 amount) public onlyOwner {
                            _mint(to, amount);
                        }
                    }`
                  }
                ]
              });
              
              const contractCode = response.data.content;
              setContractData(prev => ({ ...prev, contractCode }));
              setStep('review');
              nextAssistantMessage = {
                role: 'assistant',
                content: 'Here is your contract for review:\n\n```solidity\n' + contractCode + '\n```\n\nWould you like to deploy this contract? Make sure you have enough funds to cover the deployment gas fees.'
              };
            }
          } else {
            nextAssistantMessage = {
              role: 'assistant',
              content: 'Please select a valid contract type or type "custom" for a custom contract.'
            };
          }
          break;

        default:
          nextAssistantMessage = {
            role: 'assistant',
            content: 'An error occurred. Please start over.'
          };
      }

      setMessages(prev => [...prev, nextAssistantMessage]);
    } catch (error: APIError) {
      console.error('Error:', error);
      setToast({
        message: 'Failed to process request. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!contractData.contractCode || !window.ethereum) {
      setToast({
        message: 'Please connect your wallet first',
        type: 'error'
      });
      return;
    }

    try {
      setIsLoading(true);

      // First, request network switch to Base Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x14a34' }], // 84532 in hex
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x14a34', // 84532 in hex
              chainName: 'Base Sepolia',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org']
            }]
          });
        } else {
          throw switchError;
        }
      }

      // Get the signer after ensuring we're on the right network
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Extract and compile the contract
      const solidityCode = extractSolidityCode(contractData.contractCode);
      const compileResponse = await axios.post('/api/compile', {
        code: solidityCode
      });

      const { abi, bytecode, name } = compileResponse.data;

      setToast({
        message: 'Please confirm the transaction in your wallet...',
        type: 'success'
      });

      // Create contract factory
      const factory = new ethers.ContractFactory(abi, bytecode, signer);

      // Deploy the contract
      const contract = await factory.deploy(
        ...(contractData.contractType?.toLowerCase() === 'erc20' 
          ? ["MyToken", "MTK"] 
          : contractData.contractType?.toLowerCase() === 'erc721'
          ? ["MyNFT", "MNFT"]
          : [])
      );

      setToast({
        message: 'Waiting for deployment confirmation...',
        type: 'success'
      });

      // Wait for deployment
      await contract.waitForDeployment();
      const deployedAddress = await contract.getAddress();
      const deploymentTx = contract.deploymentTransaction();

      // Store contract info
      const contractInfo = {
        address: deployedAddress,
        network: contractData.network,
        name: name,
        abi: abi,
        deployedBy: address,
        deploymentTx: deploymentTx?.hash
      };

      // Save to local storage
      const savedContracts = JSON.parse(localStorage.getItem('deployedContracts') || '[]');
      savedContracts.push(contractInfo);
      localStorage.setItem('deployedContracts', JSON.stringify(savedContracts));

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✨ Contract successfully deployed! 🎉\n\n` +
                `📝 Contract Name: \`${name}\`\n` +
                `📍 Contract Address: \`${deployedAddress}\`\n` +
                `🌐 Network: ${contractData.network}\n` +
                `👤 Deployed by: \`${address}\`\n` +
                `🔗 Transaction: \`${deploymentTx?.hash}\`\n\n` +
                `Contract Functionality:\n` +
                `${contractData.contractType === 'custom' ? 
                  contractData.customDescription : 
                  getContractDescription(contractData.contractType)}\n\n` +
                `You can interact with your contract using the deployed address and ABI.`
      }]);

      setToast({
        message: 'Contract deployed successfully!',
        type: 'success'
      });

      setStep('deploy');

    } catch (error: APIError) {
      console.error('Error:', error);
      
      let errorMessage = 'Failed to deploy contract';
      if (error.response?.data?.details) {
        errorMessage = `Compilation error: ${error.response.data.details}`;
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was rejected in wallet. Please try again.';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for deployment. Please check your wallet balance.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add this helper function
  const getContractDescription = (type: string): string => {
    const descriptions: { [key: string]: string } = {
      'ERC20': 'Standard ERC20 token with basic functionality including transfers, allowances, and minting.',
      'ERC721': 'NFT contract with minting, transfers, and metadata support.',
      'Custom Token with Governance': 'Token contract with governance features for decentralized decision making.',
      'Multi-signature Wallet': 'Wallet requiring multiple signatures for transaction approval.',
      'Staking Contract': 'Contract for staking tokens and earning rewards.',
      'DAO Contract': 'Decentralized Autonomous Organization contract with voting and proposal mechanisms.'
    };
    return descriptions[type] || 'Custom smart contract implementation.';
  };

  // Update the formatMessage function to include the network buttons
  const formatMessage = (content: string, isFirstMessage: boolean) => {
    if (isFirstMessage) {
      return (
        <div className="space-y-4">
          <p className="text-gray-200 leading-relaxed font-light">
            Which network would you like to deploy to?
          </p>
          <NetworkButtons 
            onSelect={(network) => {
              handleNetworkSelection(network);
              const userMessage: Message = { role: 'user', content: network };
              setMessages(prev => [...prev, userMessage]);
              const assistantMessage: Message = {
                role: 'assistant',
                content: 'Great! Now, please enter your wallet address that will be the owner of the contract.'
              };
              setMessages(prev => [...prev, assistantMessage]);
            }}
          />
        </div>
      );
    }

    if (content.includes('```solidity')) {
      const [message, ...codeBlocks] = content.split('```solidity');
      const code = codeBlocks.join('').replace('```', '').trim();
      
      return (
        <div className="space-y-4">
          {message && (
            <p className="text-gray-200 leading-relaxed font-light">
              {message}
            </p>
          )}
          <div className="relative group">
            <SyntaxHighlighter
              language="solidity"
              style={atomDark}
              className="rounded-xl text-sm !bg-gray-900/50 !p-4 border border-gray-700/50 
                backdrop-blur-sm shadow-lg"
            >
              {code}
            </SyntaxHighlighter>
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 
                  border border-gray-600/30 transition-all"
                title="Copy code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <p className="text-gray-200 leading-relaxed font-light whitespace-pre-line">
        {content}
      </p>
    );
  };

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 opacity-90" />
        <FloatingLogos isMinimized={isMinimized} />
        
        {/* Animated glowing orbs with increased size and blur */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] animate-pulse-slow" />
          <div className="absolute top-3/4 right-1/4 w-[30rem] h-[30rem] bg-cyan-500/5 rounded-full blur-[120px] animate-float" />
          <div className="absolute top-1/2 right-1/3 w-[20rem] h-[20rem] bg-purple-500/5 rounded-full blur-[80px] animate-float-delay" />
        </div>
      </div>

      {/* Draggable Chat Interface */}
      <Draggable
        handle=".drag-handle"
        position={position}
        onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
      >
        <div className={`fixed z-10 transition-all duration-300 ${
          isMinimized ? 'w-72' : 'w-[800px]'
        }`}>
          <div className="chat-content">
            <div className="rounded-2xl shadow-2xl backdrop-blur-xl bg-gray-900/50 border border-gray-700/50 
              overflow-hidden neon-glow transform transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
            >
              {/* Controls Bar */}
              <div className="px-6 py-3 bg-gray-800/30 border-b border-gray-700/50 flex items-center justify-between drag-handle cursor-move">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-gray-400">
                    {contractData.network || 'Select Network'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Scale Controls */}
                  <button
                    onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                    className="p-1 hover:bg-gray-700/50 rounded"
                  >
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setScale(prev => Math.min(1.5, prev + 0.1))}
                    className="p-1 hover:bg-gray-700/50 rounded"
                  >
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                    </svg>
                  </button>
                  {/* Minimize/Maximize Button */}
                  <button
                    onClick={() => setIsMinimized(prev => !prev)}
                    className="p-1 hover:bg-gray-700/50 rounded"
                  >
                    {isMinimized ? (
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 0v12h12V3H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm14 0H3v12h14V3z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Chat Content - Only show when not minimized */}
              {!isMinimized && (
                <>
                  {/* Chat Messages */}
                  <div className="h-[36rem] overflow-y-auto p-6 space-y-6 scanline">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`${
                          message.role === 'user' 
                            ? 'flex justify-end' 
                            : 'flex justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-3xl p-4 rounded-2xl backdrop-blur-sm 
                            transition-all duration-300 hover:shadow-lg
                            ${message.role === 'user'
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
                              : 'bg-gray-800/50 text-gray-100 border border-gray-700/50 hover:border-gray-600/50 hover:shadow-gray-500/10'
                            }
                            ${index === messages.length - 1 ? 'animate-slide-up' : ''}`}
                        >
                          {typeof message.content === 'string' 
                            ? formatMessage(message.content, index === 0)
                            : message.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-center items-center py-4">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-.15s]"></div>
                          <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deploy Button */}
                  {step === 'review' && contractData.contractCode && (
                    <div className="px-6 py-4 bg-gray-800/30 border-t border-gray-700/50">
                      <button
                        onClick={handleDeploy}
                        disabled={!window.ethereum}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 
                          text-white rounded-xl font-semibold text-lg
                          hover:shadow-lg hover:shadow-blue-500/25 
                          transform hover:scale-[1.01] active:scale-[0.99]
                          transition-all duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                          border border-blue-500/20 backdrop-blur-xl
                          relative overflow-hidden group"
                      >
                        <span className="relative z-10 group-hover:text-white/90 transition-colors">
                          {window.ethereum ? 'Deploy Contract' : 'Please Connect Wallet'}
                        </span>
                        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/0 via-blue-500/40 to-blue-600/0 
                          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Input Form */}
                  <form onSubmit={handleSubmit} className="p-6 border-t border-gray-700/50 bg-gray-800/30">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="flex-1 p-4 rounded-xl bg-gray-900/50 border border-gray-700/50 
                          text-white placeholder-gray-400 backdrop-blur-xl
                          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent
                          transition-all duration-200 hover:border-gray-600/50"
                        placeholder={
                          step === 'network'
                            ? 'Enter network (base-mainnet or base-sepolia)'
                            : step === 'owner'
                            ? 'Enter owner wallet address'
                            : 'Enter your message...'
                        }
                      />
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 
                          text-white rounded-xl font-semibold
                          hover:shadow-lg hover:shadow-blue-500/25 
                          transform hover:scale-[1.02] active:scale-[0.98]
                          transition-all duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                          border border-blue-500/20 backdrop-blur-xl
                          relative overflow-hidden group"
                      >
                        <span className="relative z-10 group-hover:text-white/90">Send</span>
                        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/0 via-blue-500/40 to-blue-600/0 
                          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                        </div>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </Draggable>

      {/* WalletIsland with higher z-index */}
      <div className="relative z-50">
        <WalletIsland>
          <WalletAdvancedWalletActions />
          <WalletAdvancedAddressDetails />
          <WalletAdvancedTransactionActions />
          <WalletAdvancedTokenHoldings />
        </WalletIsland>
      </div>

      {/* Add the messages end ref */}
      <div ref={messagesEndRef} />
      
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
} 