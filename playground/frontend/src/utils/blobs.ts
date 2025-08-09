export function downloadBlob(blob: Blob, fileName: string) {

    fileName = fileName.replace(/%NOW/g, () => {
        const now = new Date();
        const parts = [
            now.getFullYear(),
            "-",
            now.getMonth() + 1,
            "-",
            now.getDate(),
            ".",
            now.getHours(),
            ".",
            now.getMinutes(),
            ".",
            now.getSeconds(),
        ];

        return parts
            .map(p =>
                typeof p === "number"
                    ? p.toString().padStart(2, "0")
                    : p)
            .join("");
    });

    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}
