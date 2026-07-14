import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "./components/Header";
import { PollList } from "./components/PollList";

function App() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {connected ? <PollList /> : <p className="text-gray-500">Connect your wallet to view polls.</p>}
      </main>
    </div>
  );
}

export default App;
