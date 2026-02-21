import { describe, expect, test } from "bun:test";
import { matchDiceRoll } from "../posts";

describe("matchDiceRoll", () => {
  test("matches 'roll the dice'", () => {
    const result = matchDiceRoll("roll the dice");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  test("matches 'Roll The Dice' case-insensitive", () => {
    const result = matchDiceRoll("Roll The Dice");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  test("matches 'roll of the dice'", () => {
    const result = matchDiceRoll("Let's roll of the dice!");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  test("matches 'roll a die' for single die", () => {
    const result = matchDiceRoll("roll a die please");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
  });

  test("matches 'rolling the dice'", () => {
    const result = matchDiceRoll("rolling the dice");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  test("matches 'rolling a die'", () => {
    const result = matchDiceRoll("I'm rolling a die");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
  });

  test("matches in longer text", () => {
    const result = matchDiceRoll("Hey can you roll the dice for me?");
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  test("does not match unrelated text", () => {
    expect(matchDiceRoll("hello world")).toBeNull();
    expect(matchDiceRoll("rolling in the deep")).toBeNull();
    expect(matchDiceRoll("dice game")).toBeNull();
    expect(matchDiceRoll("the dice rolled")).toBeNull();
  });

  test("does not match partial words", () => {
    expect(matchDiceRoll("stroll the dice")).toBeNull();
  });
});
