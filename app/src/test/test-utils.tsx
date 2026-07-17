import { type FC, type ReactElement, type ReactNode, createContext, useState, useMemo } from "react";
import { render, renderHook, type RenderOptions, type RenderHookOptions } from "@testing-library/react";
import type { VersionId } from "../config/versions";
import type { MockWallet, MockConnection, MockProgram } from "./mocks/factories";
import { createMockConnection, createMockProgram } from "./mocks/factories";

// ── Test AppState context (lightweight replacement for AppContext) ────────────

interface TestAppState {
  version: VersionId;
  setVersion: (v: VersionId) => void;
  connection: MockConnection;
  program: MockProgram | null;
  programs: Record<VersionId, MockProgram | null>;
}

const TestAppContext = createContext<TestAppState | null>(null);

export interface TestProviderOptions {
  version?: VersionId;
  wallet?: MockWallet;
  connection?: MockConnection;
  program?: MockProgram;
}

const TestAppContextProvider: FC<{ children: ReactNode; options?: TestProviderOptions }> = ({
  children,
  options = {},
}) => {
  const version = options.version ?? "v2";
  const [currentVersion, setVersion] = useState<VersionId>(version);

  const connection = useMemo(
    () => options.connection ?? createMockConnection(),
    [options.connection],
  );

  const program = useMemo(
    () => options.program ?? createMockProgram({ version: currentVersion }),
    [options.program, currentVersion],
  );

  const programs = useMemo(
    () => ({ v1: null, v2: null, v3: null, [currentVersion]: program }) as Record<VersionId, MockProgram | null>,
    [program, currentVersion],
  );

  return (
    <TestAppContext.Provider
      value={{
        version: currentVersion,
        setVersion,
        connection,
        program,
        programs,
      }}
    >
      {children}
    </TestAppContext.Provider>
  );
};

// ── Custom render ────────────────────────────────────────────────────────────

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  providerOptions?: TestProviderOptions;
}

function customRender(ui: ReactElement, options?: CustomRenderOptions) {
  const { providerOptions, ...renderOptions } = options ?? {};

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <TestAppContextProvider options={providerOptions}>{children}</TestAppContextProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// ── Custom renderHook ────────────────────────────────────────────────────────

interface CustomRenderHookOptions<Props>
  extends Omit<RenderHookOptions<Props>, "wrapper"> {
  providerOptions?: TestProviderOptions;
}

function renderHookWithProviders<Result, Props>(
  callback: (props: Props) => Result,
  options?: CustomRenderHookOptions<Props>,
) {
  const { providerOptions, ...hookOptions } = options ?? {};

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <TestAppContextProvider options={providerOptions}>{children}</TestAppContextProvider>
  );

  return renderHook(callback, { wrapper: Wrapper, ...hookOptions });
}

// ── Re-export everything from testing-library ─────────────────────────────────

export { customRender, renderHookWithProviders, TestAppContext };
export type { TestAppState };
