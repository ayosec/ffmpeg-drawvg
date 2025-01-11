import * as shaders from "./shaders";

import imageURL from "/src/assets/example.png"; // TODO(remove)

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

    let start = performance.now();
    const animate = () => {
        const d = Math.min(1, (performance.now() - start) / 1500);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.drawArrays(gl.TRIANGLE_STRIP, vertices.offset, vertices.count);

        gl.uniform1f(program.unifT, d);

        if (d < 1)
            requestAnimationFrame(animate);
    };


    const texture = gl.createTexture()!;
    fetch(imageURL)
        .then(resp => resp.blob())
        .then(createImageBitmap)
        .then(image => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                image
            );

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

            animate();
        });

}
