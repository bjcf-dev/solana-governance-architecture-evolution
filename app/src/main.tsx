import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WalletContextProvider } from "./context/WalletProvider";
import { AppContextProvider } from "./context/AppContext";
import App from "./App";
import "./index.css";

// ponytail: wallet button styles — light theme, no custom CSS module
import "@solana/wallet-adapter-react-ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletContextProvider>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </WalletContextProvider>
  </StrictMode>,
);
