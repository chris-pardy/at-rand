import { describe, expect, test } from "bun:test";
import { formatDiceReply, buildDiceEmbed } from "../dice";

describe("formatDiceReply", () => {
  test("formats single die", () => {
    expect(formatDiceReply([4])).toBe("\uD83C\uDFB2 Rolled a die");
  });

  test("formats multiple dice", () => {
    expect(formatDiceReply([3, 5])).toBe("\uD83C\uDFB2 Rolled the dice");
  });
});

describe("buildDiceEmbed", () => {
  const mockBlobs = new Map<number, any>();
  for (let i = 1; i <= 6; i++) {
    mockBlobs.set(i, { ref: `blob-${i}` });
  }

  test("creates image embed with correct $type", () => {
    const embed = buildDiceEmbed([3, 5], mockBlobs);
    expect(embed.$type).toBe("app.bsky.embed.images");
  });

  test("includes one image per die", () => {
    const embed = buildDiceEmbed([3, 5], mockBlobs);
    expect(embed.images.length).toBe(2);
  });

  test("maps values to correct blobs", () => {
    const embed = buildDiceEmbed([1, 6], mockBlobs);
    expect(embed.images[0].image).toEqual({ ref: "blob-1" });
    expect(embed.images[1].image).toEqual({ ref: "blob-6" });
  });

  test("includes alt text with face value", () => {
    const embed = buildDiceEmbed([4], mockBlobs);
    expect(embed.images[0].alt).toBe("Dice face showing 4");
  });

  test("includes square aspect ratio", () => {
    const embed = buildDiceEmbed([2], mockBlobs);
    expect(embed.images[0].aspectRatio).toEqual({ width: 1, height: 1 });
  });
});
