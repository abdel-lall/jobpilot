import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("produces an Argon2id hash and verifies only the same password", async () => {
    const hash = await hashPassword("correct-horse");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct-horse")).toBe(true);
    expect(await verifyPassword(hash, "other-horse")).toBe(false);
  });
});
