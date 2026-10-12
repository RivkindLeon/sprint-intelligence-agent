import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
const queryClient = new QueryClient();
const theme = createTheme({
  palette: {
    primary: { main: "#256b4b" },
    background: { default: "#f3f6f4" },
  },
  typography: { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
});

if (!root) {
  throw new Error("Root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
