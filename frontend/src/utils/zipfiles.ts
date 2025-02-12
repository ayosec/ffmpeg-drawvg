import { deflateRaw } from "pako";

import computeCRC32 from "./crc32";

// Expected version of the ZIP decompressor (UNIX, spec 6.3).
//
// Spec 6.3 is needed for the language encoding flag.
const ZIP_VERSION = 0x0300 | 63;

// Flag to indicate that the filename is encoded in UTF-8,
// instead of CP437.
const UTF8_FLAG = 1 << 11;

export default class ZipFile {
    #files: ArrayBuffer[] = [];

    #position = 0;

    #entries: Entry[] = [];

    add(name: string, contents: string) {
        const { date, time } = dosTime();

        const contentsBuffer = new TextEncoder().encode(contents);
        const compressed = deflateRaw(contentsBuffer, { level: 9 });

        const fileName = new TextEncoder().encode(fixName(name));

        const crc32 = computeCRC32(contentsBuffer);

        const fileHeaderBuffer = new ArrayBuffer(30);
        const fileHeader = new DataView(fileHeaderBuffer);

        fileHeader.setUint32(0, 0x504B0304);        // PK\03\04
        fileHeader.setUint16(4, ZIP_VERSION, true); // Extract version.
        fileHeader.setUint16(6, UTF8_FLAG, true);   // Flag for UTF-8 support.
        fileHeader.setUint16(8, 8, true);           // DEFLATE.
        fileHeader.setUint16(10, time, true);       // Mod. time.
        fileHeader.setUint16(12, date, true);       // Mod. date.
        fileHeader.setUint32(14, crc32, true);      // CRC32.

        fileHeader.setUint32(18, compressed.length, true);
        fileHeader.setUint32(22, contentsBuffer.length, true);
        fileHeader.setUint16(26, fileName.length, true);

        this.#entries.push({
            position: this.#position,
            fileName: fileName.buffer,
            date,
            time,
            crc32,
            compressedSize: compressed.length,
            uncompressedSize: contentsBuffer.length,
        });

        this.#files.push(fileHeaderBuffer, fileName.buffer, compressed.buffer);

        this.#position += fileHeaderBuffer.byteLength + fileName.length + compressed.length;
    }

    toChunks(): ArrayBuffer[] {
        const centralDirectory = [];

        let centralDirectoryByteSize = 0;

        for (const entry of this.#entries) {
            const cdfhBuffer = new ArrayBuffer(46);
            const cdfh = new DataView(cdfhBuffer);

            cdfh.setUint32(0, 0x504B0102);          // PK\01\02
            cdfh.setUint16(4, ZIP_VERSION, true);   // Version made by.
            cdfh.setUint16(6, ZIP_VERSION, true);   // Extract version.
            cdfh.setUint16(8, UTF8_FLAG, true);     // Flag for UTF-8 support.
            cdfh.setUint16(10, 8, true);            // DEFLATE.

            cdfh.setUint16(12, entry.time, true);
            cdfh.setUint16(14, entry.date, true);
            cdfh.setUint32(16, entry.crc32, true);
            cdfh.setUint32(20, entry.compressedSize, true);
            cdfh.setUint32(24, entry.uncompressedSize, true);
            cdfh.setUint16(28, entry.fileName.byteLength, true);

            cdfh.setUint32(42, entry.position, true);

            centralDirectory.push(cdfhBuffer, entry.fileName);
            centralDirectoryByteSize += cdfhBuffer.byteLength + entry.fileName.byteLength;
        }

        const eocdBuffer = new ArrayBuffer(22);
        const eocd = new DataView(eocdBuffer);

        eocd.setUint32(0, 0x504B0506);  // PK\05\06
        eocd.setUint16(8, this.#entries.length, true);
        eocd.setUint16(10, this.#entries.length, true);
        eocd.setUint32(12, centralDirectoryByteSize, true);
        eocd.setUint32(16, this.#position, true);

        return [
            ...this.#files,
            ...centralDirectory,
            eocdBuffer,
        ];
    }
}

interface Entry {
    position: number;
    fileName: ArrayBuffer;
    date: number;
    time: number;
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
}

function fixName(name: string) {
    return name
        .replace(/^(\w):/, "$1_")
        .replace(
            /[\0-\x20\\/]/g,
            c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
        );
}

function dosTime() {
    const now = new Date();

    let date
        = now.getDate() & 0x1F
        | (((now.getMonth() + 1) & 0xF) << 5)
        | (((now.getFullYear() - 1980) & 0x7F) << 9);

    let time
        = Math.floor(now.getSeconds() / 2)
        | ((now.getMinutes() & 0x3F) << 5)
        | ((now.getHours() & 0x1F) << 11);

    return { date, time };
}
