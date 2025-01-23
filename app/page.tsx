'use client';

import ChatBot from './components/ChatBot';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8 font-sans">
      <ChatBot />
    </main>
  );
}
