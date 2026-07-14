import { createContext, useContext, type FC, type ReactNode, useState, useMemo } from "react";
import { Connection } from "@solana/web3.js";
import { Program } from "@anchor-lang/core";
import { useWallet } from "@solana/wallet-adapter-react";
import type { VersionId } from "../config/versions";
import { CLUSTER_URL } from "../config/versions";
import v1Idl from "../config/idl/v1.json";
import v2Idl from "../config/idl/v2.json";
import v3Idl from "../config/idl/v3.json";

interface AppState {
  version: VersionId;
  setVersion: (v: VersionId) => void;
  connection: Connection;
  /** Program for the currently selected version */
  program: Program | null;
  /** All program instances keyed by version id */
  programs: Record<VersionId, Program | null>;
}

const AppContext = createContext<AppState | null>(null);

const IDLS: Record<VersionId, unknown> = { v1: v1Idl, v2: v2Idl, v3: v3Idl };

// ponytail: single connection shared across versions
const connection = new Connection(CLUSTER_URL, "confirmed");

export const AppContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [version, setVersion] = useState<VersionId>("v2");
  const wallet = useWallet();

  const programs = useMemo(() => {
    const p = {} as Record<VersionId, Program | null>;
    for (const v of ["v1", "v2", "v3"] as VersionId[]) {
      if (!wallet.publicKey) {
        p[v] = null;
        continue;
      }
      p[v] = new Program(IDLS[v], {
        connection,
        publicKey: wallet.publicKey,
        // ponytail: signTransaction/signAllTransactions from wallet — null means
        // read-only; write instructions need a signer attached at call site.
      });
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey?.toBase58()]);

  const program = programs[version];

  return (
    <AppContext.Provider value={{ version, setVersion, connection, program, programs }}>
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContextProvider");
  return ctx;
}
