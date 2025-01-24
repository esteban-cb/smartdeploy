'use client';

interface ExamplePrompt {
  title: string;
  description: string;
  complexity: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  template: string;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    title: 'Simple ETH Forwarder',
    description: 'Forward received ETH to a specified address',
    complexity: 'Beginner',
    template: 'Write a smart contract that can receive ETH on base-sepolia and forward it to "{YOUR_ADDRESS}"'
  },
  {
    title: 'Basic ERC20 Token',
    description: 'Create a simple ERC20 token with fixed supply',
    complexity: 'Intermediate',
    template: 'Create an ERC20 token on base-sepolia and name it "{TOKEN_NAME}" with a supply of {SUPPLY}'
  },
  {
    title: 'ETH Splitter',
    description: 'Split received ETH between two addresses',
    complexity: 'Advanced',
    template: 'Write a smart contract that can receive ETH on base-sepolia and send the received ETH 90% to "{ADDRESS_A}" and 10% to "{ADDRESS_B}"'
  },
  {
    title: 'Auto-Minting Token',
    description: 'ERC20 token that mints new tokens when receiving ETH',
    complexity: 'Expert',
    template: 'Create an ERC20 token on base-sepolia and name it "{TOKEN_NAME}" with an initial supply of 1,000,000 and max supply of 10,000,000. Every 0.01 ETH on base-sepolia the token contract receives mints 1,000,000 more of the supply. The address which sent the ETH receives the newly minted tokens. The amount minted can\'t exceed the max total supply of 10,000,000'
  }
];

interface ExamplePromptsProps {
  onSelectPrompt: (prompt: string) => void;
  onPopulateInput: (template: string) => void;
}

export default function ExamplePrompts({ onSelectPrompt, onPopulateInput }: ExamplePromptsProps) {
  return (
    <div className="rounded-2xl backdrop-blur-xl bg-gray-900/50 border border-gray-700/50 
      overflow-hidden shadow-2xl animate-fade-in">
      <div className="px-6 py-4 bg-gray-800/30 border-b border-gray-700/50">
        <h2 className="text-lg font-semibold text-white">
          Example Contract Prompts
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Select a template to get started
        </p>
      </div>
      
      <div className="p-6 space-y-4">
        {EXAMPLE_PROMPTS.map((prompt, index) => (
          <div
            key={index}
            className="group relative rounded-xl bg-gray-800/30 border border-gray-700/50 
              hover:border-blue-500/50 transition-all duration-300
              hover:shadow-lg hover:shadow-blue-500/10"
          >
            <div className="absolute -top-2 -right-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium
                ${prompt.complexity === 'Beginner' ? 'bg-green-500/80' :
                  prompt.complexity === 'Intermediate' ? 'bg-yellow-500/80' :
                  prompt.complexity === 'Advanced' ? 'bg-orange-500/80' :
                  'bg-red-500/80'} 
                text-white shadow-lg`}>
                {prompt.complexity}
              </span>
            </div>
            
            <button
              onClick={() => {
                onPopulateInput(prompt.template);
                onSelectPrompt(prompt.template);
              }}
              className="w-full p-4 text-left"
            >
              <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">
                {prompt.title}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {prompt.description}
              </p>
              <div className="mt-3 text-xs text-gray-500 line-clamp-2 group-hover:text-gray-400">
                {prompt.template}
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 