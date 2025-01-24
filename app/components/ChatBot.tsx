'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ethers } from 'ethers';
import Draggable from 'react-draggable';
import { FloatingLogos } from './FloatingLogos';
import ExamplePrompts from './ExamplePrompts';
import { getAddress } from 'viem';
import { 
  Wallet, 
  ConnectWallet,
  WalletDropdown,
  WalletDropdownDisconnect 
} from '@coinbase/onchainkit/wallet';
import { Fragment, JsonFragment } from '@ethersproject/abi';

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

interface CompileResponse {
  abi: (string | Fragment | JsonFragment)[];
  bytecode: string;
  name: string;
  constructorInputs: { name: string; type: string; }[];
}

// Update the Toast component to use blue colors
const Toast = ({ message, type = 'error', onClose }: { message: string; type?: 'error' | 'success'; onClose: () => void }) => (
  <div className={`fixed bottom-4 right-4 p-4 rounded-2xl backdrop-blur-md shadow-2xl 
    border border-opacity-30 animate-slide-up
    ${type === 'error' 
      ? 'bg-red-500/70 border-red-400 shadow-red-500/20' 
      : 'bg-blue-600/70 border-blue-400 shadow-blue-500/20'
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

// Update error type
interface DeployError {
  response?: {
    data?: {
      details?: string;
    };
  };
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
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDeploying, setIsDeploying] = useState(false);
  const [isContractFullyDisplayed, setIsContractFullyDisplayed] = useState(false);

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

  const handleNetworkSelection = async (input: string) => {
    const network = input.toLowerCase();
    if (network === 'base-mainnet' || network === 'base-sepolia') {
      setContractData(prev => ({ ...prev, network: network as 'base-mainnet' | 'base-sepolia' }));
      setStep('owner');

      // Get connected wallet address if available
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          
          // Only show the connected wallet message
          setMessages(prev => [...prev, 
            {
              role: 'assistant',
              content: `Connected wallet detected: ${address}\n\nWould you like to use this address as the contract owner? Type 'yes' to confirm, or enter a different address.`
            }
          ]);
          
          // Pre-fill the input with the connected address
          setInput(address);
        } catch {
          // If we can't get the address, show a simple prompt
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Please enter the wallet address that will be the contract owner.'
          }]);
        }
      }
      return true;
    }
    return false;
  };

  const handleOwnerAddress = (input: string) => {
    try {
      const checksummedAddress = getAddress(input);
      setContractData(prev => ({ ...prev, ownerAddress: checksummedAddress }));
      setStep('type');
      return true;
    } catch {
      setToast({
        message: 'Invalid Ethereum address format',
        type: 'error'
      });
      return false;
    }
  };

  const handleContractTypeInput = async (input: string) => {
    try {
      const result = await handleContractTypeInput(input);
      if (result.isValid) {
        const response = await axios.post<CompileResponse>('/api/compile', {
          code: extractSolidityCode(contractData.contractCode || '')
        });
        
        const { abi, bytecode, name, constructorInputs } = response.data;
        console.log('Contract compiled:', { abi, bytecode, name, constructorInputs });
        
        setContractData(prev => ({ ...prev, contractType: 'Custom', contractCode: input }));
        setStep('review');
        setIsContractFullyDisplayed(false);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Here is your contract for review:\n\n```solidity\n' + input + '\n```\n\nPlease review the contract carefully before deploying.'
        }]);

        return {
          isValid: true,
          message: null
        };
      } else {
        return {
          isValid: false,
          message: null
        };
      }
    } catch {
      console.error('Failed to generate contract');
      setToast({
        message: 'Failed to generate contract. Please try again.',
        type: 'error'
      });
      return {
        isValid: false,
        message: null
      };
    }
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
          if (await handleNetworkSelection(input)) {
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
          if (input.toLowerCase() === 'yes' && window.ethereum) {
            // Use the connected wallet address
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const rawAddress = await signer.getAddress();
            const address = getAddress(rawAddress); // Ensure proper checksum
            
            if (handleOwnerAddress(address)) {
              nextAssistantMessage = {
                role: 'assistant',
                content: 'Please describe the contract you want to create in as much detail as possible...'
              };
              setStep('type');
            }
          } else if (handleOwnerAddress(input)) {
            nextAssistantMessage = {
              role: 'assistant',
              content: 'Please describe the contract you want to create in as much detail as possible...'
            };
            setStep('type');
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
            nextAssistantMessage = {
              role: 'assistant',
              content: result.message || 'Please describe the contract you want to create.'
            };
          } else {
            nextAssistantMessage = {
              role: 'assistant',
              content: 'Please provide a detailed description of the contract you want to create.'
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
    } catch {
      console.error('Failed to process request');
      setToast({
        message: 'Failed to process request. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!contractData.contractCode || !window.ethereum) return;

    setIsDeploying(true);
    setToast({
      message: 'Please confirm the transaction in your wallet...',
      type: 'success'
    });

    try {
      // First compile the contract
      const response = await axios.post<CompileResponse>('/api/compile', {
        code: extractSolidityCode(contractData.contractCode || '')
      });

      const { abi, bytecode, name, constructorInputs } = response.data;

      // Get wallet address
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Create contract factory
      const factory = new ethers.ContractFactory(abi, bytecode, signer);

      // Smart constructor argument handling
      let constructorArgs: (string | number)[] = [];
      if (constructorInputs && constructorInputs.length > 0) {
        // Check if it's a token contract by looking at the constructor inputs
        const isTokenContract = constructorInputs.some(input => 
          input.name.toLowerCase().includes('name') || 
          input.name.toLowerCase().includes('symbol')
        );

        if (isTokenContract) {
          // For token contracts, use default values
          constructorArgs = constructorInputs.map(input => {
            if (input.name.toLowerCase().includes('name')) return name;
            if (input.name.toLowerCase().includes('symbol')) return name.slice(0, 4).toUpperCase();
            if (input.type === 'address') return address; // Use deployer address for any address params
            if (input.type === 'uint256') return '1000000000000000000000000'; // Default supply: 1M tokens
            return ''; // Default empty string for unknown params
          });
        } else {
          // For non-token contracts, extract values from the contract description
          const description = contractData.contractCode.toLowerCase();
          constructorArgs = constructorInputs.map(input => {
            if (input.type === 'address') {
              // Try to find addresses in the description
              const addressMatch = description.match(/0x[a-fA-F0-9]{40}/);
              return addressMatch ? addressMatch[0] : address;
            }
            if (input.type === 'uint256') {
              // Try to find numbers in the description
              const numberMatch = description.match(/\b\d+\b/);
              return numberMatch ? numberMatch[0] : '0';
            }
            return ''; // Default empty string for unknown params
          });
        }
      }

      // Deploy the contract with constructor arguments
      const contract = await factory.deploy(...constructorArgs);
      const deploymentTx = contract.deploymentTransaction();
      
      // Wait for deployment
      const deployedContract = await contract.waitForDeployment();
      const deployedAddress = await deployedContract.getAddress();

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

      // Update messages with success
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✨ Contract successfully deployed! 🎉\n\n` +
                `📝 Contract Name: \`${name}\`\n` +
                `📍 Contract Address: \`${deployedAddress}\`\n` +
                `🌐 Network: ${contractData.network}\n` +
                `👤 Deployed by: \`${address}\`\n` +
                `🔗 Transaction: \`${deploymentTx?.hash}\`\n\n` +
                `You can interact with your contract using the deployed address and ABI.`
      }]);

      setToast({
        message: 'Contract deployed successfully!',
        type: 'success'
      });

      setStep('deploy');

    } catch (error) {
      const err = error as DeployError;
      console.error('Error:', err);
      
      let errorMessage = 'Failed to deploy contract';
      if (err.response?.data?.details) {
        errorMessage = `Compilation error: ${err.response.data.details}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Update the formatMessage function
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
            }}
          />
        </div>
      );
    }

    // For contract description prompt
    if (content.includes('Please describe the contract you want to create')) {
      return (
        <div className="space-y-4">
          <p className="text-gray-200 leading-relaxed font-light">
            {content}
          </p>
          <ExamplePrompts 
            onSelectPrompt={(template) => {
              setInput(template); // Just populate the input
            }}
            onPopulateInput={(template) => {
              setInput(template); // This is redundant now, we can remove this prop
            }}
          />
        </div>
      );
    }

    // Add restart option after successful deployment
    if (content.includes('Contract successfully deployed!')) {
      return (
        <div className="space-y-4">
          <div className="text-gray-200 leading-relaxed font-light whitespace-pre-line">
            {content}
          </div>
          <button
            onClick={() => {
              // Reset all states
              setMessages([{
                role: 'assistant',
                content: 'Which network would you like to deploy to?'
              }]);
              setContractData({
                network: null,
                ownerAddress: null,
                contractType: null,
                contractCode: null,
              });
              setStep('network');
              setInput('');
            }}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 
              text-white rounded-xl font-semibold text-lg
              hover:shadow-lg hover:shadow-blue-500/25 
              transform hover:scale-[1.01] active:scale-[0.99]
              transition-all duration-200
              border border-blue-500/20 backdrop-blur-xl"
          >
            Deploy Another Contract
          </button>
        </div>
      );
    }

    if (content.includes('```solidity')) {
      const [message, ...codeBlocks] = content.split('```solidity');
      const code = codeBlocks.join('').replace('```', '').trim();
      
      // Set contract as fully displayed after a small delay to ensure rendering
      setTimeout(() => setIsContractFullyDisplayed(true), 100);
      
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

  // Add new state for tracking scroll position
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Add scroll handler
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50; // 50px threshold
      setHasScrolledToBottom(isAtBottom);
    }
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
          isMinimized ? 'w-72' : 'w-[900px]'
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
                  <div 
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="h-[36rem] overflow-y-auto p-6 space-y-6 scanline"
                  >
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

                  {/* Deploy Button - Only show when scrolled to bottom */}
                  {step === 'review' && 
                    contractData.contractCode && 
                    isContractFullyDisplayed && 
                    hasScrolledToBottom && (
                    <div className="animate-fade-in px-6 py-4 bg-gray-800/30 border-t border-gray-700/50">
                      <button
                        onClick={handleDeploy}
                        disabled={!window.ethereum || isDeploying}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 
                          text-white rounded-xl font-semibold text-lg
                          hover:shadow-lg hover:shadow-blue-500/25 
                          transform hover:scale-[1.01] active:scale-[0.99]
                          transition-all duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                          border border-blue-500/20 backdrop-blur-xl
                          relative overflow-hidden group"
                      >
                        <span className="relative z-10 group-hover:text-white/90 transition-colors flex items-center justify-center gap-3">
                          {isDeploying ? (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce [animation-delay:-.15s]"></div>
                                <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                              </div>
                              <span>Waiting for Wallet...</span>
                            </>
                          ) : window.ethereum ? (
                            'Deploy Contract'
                          ) : (
                            'Please Connect Wallet'
                          )}
                        </span>
                        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/0 via-blue-500/40 to-blue-600/0 
                          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Scroll indicator - Always show when contract is displayed but not scrolled */}
                  {step === 'review' && 
                    contractData.contractCode && 
                    isContractFullyDisplayed && 
                    !hasScrolledToBottom && (
                    <div className="sticky bottom-0 px-6 py-4 bg-gray-800/95 border-t border-gray-700/50 backdrop-blur-xl">
                      <div className="text-center text-gray-400 text-sm animate-bounce">
                        Scroll to bottom to review and deploy ↓
                      </div>
                    </div>
                  )}

                  {/* Input Form - Only show if not in review or deploy step */}
                  {step !== 'review' && step !== 'deploy' && (
                    <form onSubmit={handleSubmit} className="p-6 border-t border-gray-700/50 bg-gray-800/30">
                      <div className="flex gap-3">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          rows={4}
                          className="flex-1 p-4 rounded-xl bg-gray-900/50 border border-gray-700/50 
                            text-white placeholder-gray-400 backdrop-blur-xl
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent
                            transition-all duration-200 hover:border-gray-600/50 resize-none"
                          placeholder={
                            step === 'network'
                              ? 'Enter network (base-mainnet or base-sepolia)'
                              : step === 'owner'
                              ? 'Enter owner wallet address'
                              : 'Enter your message or select a template above...'
                          }
                        />
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="px-8 self-end bg-gradient-to-r from-blue-600 to-blue-700 
                            text-white rounded-xl font-semibold h-[52px]
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
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Draggable>

      {/* Replace the old wallet section with the proper Wallet component */}
      <div className="relative z-50">
        <Wallet>
          <ConnectWallet>
            <WalletDropdown>
              <WalletDropdownDisconnect />
            </WalletDropdown>
          </ConnectWallet>
        </Wallet>
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