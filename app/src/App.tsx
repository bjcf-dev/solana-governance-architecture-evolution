import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "./components/Header";
import { PollList } from "./components/PollList";
import { LandingPage } from "./components/LandingPage";

function App() {
  const { connected } = useWallet();

  return (
    <div className="relative min-h-screen overflow-hidden bg-solana-black">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-solana-purple opacity-[0.06] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-solana-cyan opacity-[0.04] blur-[120px]" />

      <div className="relative z-10">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8 max-md:px-3 max-md:py-6">
          {connected ? <PollList /> : <LandingPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
