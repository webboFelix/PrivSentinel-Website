import { describe, expect, it } from "vitest";
import { shouldPersistQuery } from "./query-client";

describe("shouldPersistQuery", () => {
  it("persists only successful public query results", () => {
    expect(shouldPersistQuery(["releases"], "success")).toBe(true);
    expect(shouldPersistQuery(["testimonials", "approved"], "success")).toBe(true);
    expect(shouldPersistQuery(["releases"], "pending")).toBe(false);
    expect(shouldPersistQuery(["releases"], "error")).toBe(false);
  });

  it("does not persist private or partially matching query keys", () => {
    expect(shouldPersistQuery(["account-data"], "success")).toBe(false);
    expect(shouldPersistQuery(["releases", "latest"], "success")).toBe(false);
  });
});
