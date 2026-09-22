import { describe, it, expect } from "vitest";
import id from "@/components/translate/id";
import en from "@/components/translate/en";
import { renderHookWithProviders } from "@/test/render";
import { useMeetingLabels } from "./labels";

type Dict = { readonly [key: string]: string | Dict };
const keys = (obj: Dict, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`))).sort();

describe("meeting room labels", () => {
  it("kids mode has exactly the same meeting room keys as the default view", () => {
    expect(keys(id.kids.meetingRoom)).toEqual(keys(id.meetingRoom));
    expect(keys(en.kids.meetingRoom)).toEqual(keys(en.meetingRoom));
  });
});

describe("useMeetingLabels", () => {
  it("reads the kids wording in kids mode and fills in params", async () => {
    const normal = (await renderHookWithProviders(() => useMeetingLabels("default"))).result.current;
    const kids = (await renderHookWithProviders(() => useMeetingLabels("kids"))).result.current;

    expect(normal("you")).toBe(id.meetingRoom.you);
    expect(kids("you")).toBe(id.kids.meetingRoom.you);
    expect(normal("sharing", { name: "Ani" })).toBe("Ani sedang berbagi layar");
  });
});
