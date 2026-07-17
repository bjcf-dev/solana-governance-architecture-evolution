import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function LandingPage() {
  const { setVisible } = useWalletModal();

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Badge */}
      <span className="mb-6 inline-block rounded-full border border-solana-purple/50 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-solana-purple">
        ✦ Solana Governance
      </span>

      {/* Gradient title */}
      <h1 className="mb-3 bg-gradient-to-r from-solana-white via-solana-white to-solana-purple bg-clip-text text-4xl font-bold text-transparent md:text-5xl max-md:text-3xl">
        Shape the Protocol
      </h1>

      {/* Subtitle */}
      <p className="mb-8 max-w-lg text-lg font-light leading-relaxed text-solana-gray">
        Propose, discuss, and vote on-chain. Every token holder has a voice in
        the future of the DAO.
      </p>

      {/* CTA */}
      <button
        onClick={() => setVisible(true)}
        className="rounded-xl bg-solana-purple px-8 py-3 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-solana-purple-dark hover:shadow-solana-purple-glow"
      >
        Connect Wallet to Start
      </button>

      {/* Feature cards */}
      <div className="mt-12 flex flex-wrap justify-center gap-4 max-md:flex-col max-md:items-center">
        {([
          { icon: "🗳️", title: "On-Chain Voting", desc: "Every vote is recorded on Solana — transparent, verifiable, immutable." },
          { icon: "🔒", title: "Token-Gated", desc: "Voting power scales with your stake. More tokens, more influence." },
          { icon: "📊", title: "Live Results", desc: "Real-time tally as votes come in. No more waiting for snapshots." },
        ] as const).map((f, i) => (
          <div key={f.title} className="animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
            <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="glass-card w-[220px] rounded-xl p-5 text-left transition-all duration-200 max-md:w-full">
      <div className="mb-2 text-2xl">{icon}</div>
      <h3 className="mb-1 text-sm font-semibold text-solana-purple">{title}</h3>
      <p className="text-xs leading-relaxed text-solana-gray">{desc}</p>
    </div>
  );
}
