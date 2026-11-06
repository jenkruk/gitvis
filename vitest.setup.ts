import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// `server-only` throws outside the react-server condition; server modules are unit-tested directly.
vi.mock("server-only", () => ({}));
