interface Base64 {
    encode(data: Uint8Array): string;
    decode(data: string): Uint8Array;
}

const base64: Base64 = <const>{
    decode: (
        (<any>Uint8Array).fromBase64
            ? (<any>Uint8Array).fromBase64
            : (data: string) => Uint8Array.from(atob(data), c => c.charCodeAt(0))
    ),

    encode: (
        ("toBase64" in Uint8Array.prototype)
            ? (data: Uint8Array) => (<any>data).toBase64()
            : (data: Uint8Array) => btoa(String.fromCodePoint(...data))
    ),
};

export default base64;
