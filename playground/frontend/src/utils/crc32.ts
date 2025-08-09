export default function computeCRC32(buffer: Uint8Array) {
    const end = buffer.length;
    let crc = 0xFFFFFFFF;

    for (let i = 0; i < end; i++) {
        crc ^= buffer[i];
        for (let j = 0; j < 8; j++)
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }

    return crc ^ 0xFFFFFFFF;
}
