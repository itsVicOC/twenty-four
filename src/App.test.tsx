import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the playable shell", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const root = createRoot(element);

    await act(async () => {
      root.render(<App />);
    });

    expect(element.textContent).toContain("24 点竞技场");
    expect(element.textContent).toContain("排行榜");

    await act(async () => {
      root.unmount();
    });
  });
});
