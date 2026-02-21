import { describe, expect, test } from "bun:test";
import { deriveValue } from "../drand";

describe("deriveValue", () => {
  const randomness = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

  test("returns value within range", () => {
    for (let i = 0; i < 100; i++) {
      const val = deriveValue(randomness, `rkey-${i}`, 0, 1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
    }
  });

  test("is deterministic", () => {
    const a = deriveValue(randomness, "rkey-abc", 0, 1, 6);
    const b = deriveValue(randomness, "rkey-abc", 0, 1, 6);
    expect(a).toBe(b);
  });

  test("different rkeys produce different values (statistically)", () => {
    const values = new Set<number>();
    for (let i = 0; i < 50; i++) {
      values.add(deriveValue(randomness, `rkey-${i}`, 0, 1, 100));
    }
    // With 50 draws from 1-100, we should get many distinct values
    expect(values.size).toBeGreaterThan(10);
  });

  test("different indices produce different values", () => {
    const a = deriveValue(randomness, "rkey-same", 0, 1, 1000);
    const b = deriveValue(randomness, "rkey-same", 1, 1, 1000);
    // Not guaranteed different but extremely unlikely to be equal with range 1000
    // If this flakes, it's a 1/1000 chance
    expect(a).not.toBe(b);
  });

  test("different randomness produces different values", () => {
    const r2 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const a = deriveValue(randomness, "rkey-x", 0, 1, 1000);
    const b = deriveValue(r2, "rkey-x", 0, 1, 1000);
    expect(a).not.toBe(b);
  });

  test("handles single-value range", () => {
    const val = deriveValue(randomness, "rkey", 0, 5, 5);
    expect(val).toBe(5);
  });
});
