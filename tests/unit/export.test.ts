import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";
import { crc32, createZip } from "@/lib/export/zip";

describe("toCsv", () => {
  it("writes header + rows with BOM and CRLF", () => {
    expect(
      toCsv([
        { a: 1, b: "x" },
        { a: 2, b: "y" },
      ]),
    ).toBe("﻿a,b\r\n1,x\r\n2,y\r\n");
  });
  it("quotes commas, quotes, newlines; JSON-encodes objects; blanks nulls; unions columns", () => {
    const csv = toCsv([{ t: 'he said "hi", ok' }, { t: "line1\nline2", o: { k: [1] }, n: null }]);
    expect(csv).toBe('﻿t,o,n\r\n"he said ""hi"", ok",,\r\n"line1\nline2","{""k"":[1]}",\r\n');
  });
  it("keeps Thai text intact", () => {
    expect(toCsv([{ title: "อ่านหนังสือ" }])).toContain("อ่านหนังสือ");
  });
  it("neutralises spreadsheet formulas in text cells (M1-F4)", () => {
    expect(toCsv([{ t: "=HYPERLINK(1)" }, { t: "+1" }, { t: "-2" }, { t: "@x" }, { t: "ok" }])).toBe(
      "\uFEFFt\r\n'=HYPERLINK(1)\r\n'+1\r\n'-2\r\n'@x\r\nok\r\n",
    );
    expect(toCsv([{ n: -5 }])).toBe("\uFEFFn\r\n-5\r\n");
  });

  it("handles an empty table", () => {
    expect(toCsv([])).toBe("﻿");
  });
});

describe("createZip", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });

  it("produces a zip that the system unzip can read (UTF-8 content round-trips)", () => {
    const enc = new TextEncoder();
    const zip = createZip([
      { name: "a.csv", data: enc.encode("x,y\r\n1,2\r\n") },
      { name: "thai.csv", data: enc.encode("ชื่อ\r\nมินนี่\r\n") },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    writeFileSync(join(dir, "out.zip"), zip);
    execFileSync("unzip", ["-q", "out.zip"], { cwd: dir });
    expect(readFileSync(join(dir, "a.csv"), "utf8")).toBe("x,y\r\n1,2\r\n");
    expect(readFileSync(join(dir, "thai.csv"), "utf8")).toBe("ชื่อ\r\nมินนี่\r\n");
  });
});
