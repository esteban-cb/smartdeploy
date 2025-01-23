'use client';

import { ChatBot } from './components/ChatBot';
import { OnchainKitProvider } from '@onchainkit/kit';

export default function Home() {
  return (
    <OnchainKitProvider>
      <main className="flex min-h-screen flex-col items-center justify-between">
        <ChatBot />
      </main>
    </OnchainKitProvider>
  );
}
