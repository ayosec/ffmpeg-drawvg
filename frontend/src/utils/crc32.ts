function makeTable() {
    return Uint32Array.from({ length: 255 }, (_, c) => {
        for (let k = 0; k < 8; k++)
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));

        return c;
    });
}

let TABLE: Uint32Array|undefined = undefined;

export default function computeCRC32(buffer: Uint8Array) {
    if (TABLE === undefined)
        TABLE = makeTable();

    const end = buffer.length;
    let crc = -1;

    for (let i = 0; i < end; i++)
        crc = (crc >>> 8) ^ TABLE[(crc ^ buffer[i]) & 0xFF];

    return (crc ^ (-1));
}
