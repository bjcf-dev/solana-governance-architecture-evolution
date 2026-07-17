import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useApp } from "../context/AppContext";
import { VERSIONS } from "../config/versions";
import type { VersionId } from "../config/versions";

function VersionSelector() {
  const { version, setVersion } = useApp();
  return (
    <select
      value={version}
      onChange={(e) => setVersion(e.target.value as VersionId)}
      className="rounded border px-3 py-1.5 text-sm"
    >
      {VERSIONS.map((v) => (
        <option key={v.id} value={v.id}>{v.label}</option>
      ))}
    </select>
  );
}

export function Header() {
  const { connected } = useWallet();

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      <h1 className="text-xl font-semibold">Solana Governance</h1>
      <div className="flex items-center gap-3">
        <VersionSelector />
        <WalletMultiButton />
      </div>
      {!connected && (
        <p className="absolute left-1/2 -translate-x-1/2 text-sm text-gray-400">
          Connect your wallet to interact with polls
        </p>
      )}
    </header>
  );
}
