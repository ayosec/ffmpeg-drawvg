import fs from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

import * as yauzl from "yauzl";
import { expect, test } from "vitest";

import ZipFile from "./zipfiles";

test("create a ZIP file", async () => {
    const largeFile = fs.readFileSync(import.meta.filename, { encoding: "utf-8" });

    const zip = new ZipFile();
    zip.add("a", largeFile);
    zip.add("b/c", "11");
    zip.add("d\x01", "222");
    zip.add("c:abc", "3333");
    zip.add("✓ Unicode", "44444");

    const fileName = tempFile();

    const fh = fs.openSync(fileName, "w");
    for (const chunk of zip.toChunks())
        fs.writeFileSync(fh, new DataView(chunk));
    fs.closeSync(fh);

    const entries = await readZipFile(fileName);

    expect(entries.size).toEqual(5);
    expect(entries.get("a")).toEqual(largeFile);
    expect(entries.get("b%2fc")).toEqual("11");
    expect(entries.get("d%01")).toEqual("222");
    expect(entries.get("c_abc")).toEqual("3333");
    expect(entries.get("✓ Unicode")).toEqual("44444");
});

function tempFile() {
    return path.join(tmpdir(), randomUUID() + ".zip");
}

function readZipFile(file: string) {
    return new Promise<Map<string, string>>((resolve, reject) => {
        yauzl.open(
            file,
            {
                decodeStrings: true,
                lazyEntries: true,
                strictFileNames: true,
            },
            (err, zipfile) => {
                if (err)
                    return reject(err);

                const entries = new Map<string, string>();

                zipfile.on("error", reject);

                zipfile.on("end", () => resolve(entries));

                zipfile.on("entry", (entry: yauzl.Entry) => {
                    const name = entry.fileName;
                    let contents = "";

                    zipfile.openReadStream(entry, (err, data) => {
                        if (err)
                            return reject(err);

                        const now = new Date().getTime();
                        const mtime = entry.getLastModDate().getTime();
                        if (Math.abs(now - mtime) > 10_000)
                            return reject("mtime should be recent");

                        data.setEncoding("utf8");
                        data.on("error", reject);
                        data.on("data", chunk => { contents += chunk; });
                        data.on("end", () => {
                            if (crc32(contents) !== entry.crc32)
                                reject(`Invalid CRC32 (${entry.crc32} != ${crc32(contents)})`);

                            entries.set(name, contents);
                            zipfile.readEntry();
                        });
                    });
                });

                zipfile.readEntry();
            },
        );
    });
}
