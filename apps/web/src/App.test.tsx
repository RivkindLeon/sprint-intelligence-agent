import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the dashboard shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Sprint Intelligence" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/evidence-backed analysis/i)).toBeInTheDocument();
  });
});
