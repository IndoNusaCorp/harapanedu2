import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import id from "./id";
import en from "./en";

type Dict = { readonly [key: string]: string | Dict };

function flatten(obj: Dict, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[fullKey] = value;
    else Object.assign(acc, flatten(value, fullKey));
    return acc;
  }, {});
}

const placeholders = (value: string) =>
  [...value.matchAll(/{([^}]*)}/g)].map((m) => m[1]).sort();

const flatId = flatten(id);
const flatEn = flatten(en);

describe("translation dictionaries", () => {
  it("id and en have exactly the same keys", () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatId).sort());
  });

  it("id and en use the same placeholders for every key", () => {
    for (const key of Object.keys(flatId)) {
      expect(placeholders(flatEn[key] ?? ""), key).toEqual(placeholders(flatId[key]));
    }
  });

  it("has no empty translations", () => {
    for (const [key, value] of [...Object.entries(flatId), ...Object.entries(flatEn)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("defines #one and #other for every plural key, with a {count} placeholder", () => {
    const pluralBases = new Set(
      Object.keys(flatId).filter((k) => k.includes("#")).map((k) => k.split("#")[0])
    );
    for (const base of pluralBases) {
      for (const dict of [flatId, flatEn]) {
        expect(dict[`${base}#one`], `${base}#one`).toBeDefined();
        expect(dict[`${base}#other`], `${base}#other`).toBeDefined();
        expect(placeholders(dict[`${base}#other`]), base).toContain("count");
      }
    }
  });

  it("every t('...') key used in the source code exists in the dictionaries", () => {
    const srcDir = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(srcDir);

    const validKeys = new Set([
      ...Object.keys(flatId),
      ...Object.keys(flatId).filter((k) => k.includes("#")).map((k) => k.split("#")[0]),
    ]);

    const missing: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_.#]+)["'`]/g)) {
        if (!validKeys.has(match[1])) missing.push(`${path.relative(srcDir, file)}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
