import createBackend from "./backend";
import * as shaders from "./graphics";

let CANVAS: HTMLCanvasElement | undefined;

self.onmessage = event => {

    const newCanvas = event.data.registry;
    if (newCanvas) {
        if (!Object.is(newCanvas, CANVAS)) {
            register(newCanvas);
            CANVAS = newCanvas;
        }

        return;
    }

    console.error("Invalid message", event.data);
};

function register(canvas: OffscreenCanvas) {

    const gl = canvas.getContext("webgl");

    if (gl === null) {
        console.error("Can't get OffscreenCanvas context.");
        return;
    }

    const program = shaders.compileProgram(gl);
    if (program === null)
        return;

    const vertices = shaders.verticesBuffer(gl);

    shaders.prepareProgram(gl, program, vertices);

    const texture = gl.createTexture()!;

    createBackend()
        .then(backend => {
            const prg = backend.compile(
                `
                repeat 6 {
                    circle (w/8 * i + t*w) (h/2) 50
                    setcolor blue@0.2 fill
                    if (eq(mod(i,3), 0)) { newpath }
                }
            `)!;

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

            const START = performance.now();
            let N = 0;

            const animate = () => {
                N++;
                const T = (performance.now() - START) / 1000;
                const W = canvas.width;
                const H = canvas.height;

                const data = prg.run(N % 25 == 0, W, H, T, N, 1 / 60);

                if (data == null)
                    return;

                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    W, H, 0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    data.get(),
                );

                data.free();

                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);

                gl.drawArrays(gl.TRIANGLE_STRIP, vertices.offset, vertices.count);

                if (T < 1) {
                    requestAnimationFrame(animate);
                } else {
                    prg.free();
                }
            };

            animate();
        });

}
