import { ArrayBufferTarget, Muxer } from "webm-muxer";

import { Machine } from "./machine";
import { Response, VideoParams } from "./protocol";

function mkCodec(codec: string) {
    if (codec.startsWith("av01"))
        return "V_AV1";
    else if (codec.startsWith("vp09"))
        return "V_VP9";
    else if (codec === "vp8")
        return "V_VP8";
    else
        throw new Error("Invalid codec: " + codec);
}

export default async function exportVideo(machine: Machine, params: VideoParams) {
    const vgsProgram = machine.compile(0, params.source);
    if (vgsProgram === null) {
        self.postMessage(<Response>{ videoError: {error: "Compilation failed." } });
        return;
    }


    // Muxer for the video stream.

    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: mkCodec(params.encoderConfig.codec),
            width: params.encoderConfig.width,
            height: params.encoderConfig.height,
            frameRate: params.encoderConfig.framerate,
        },
    });


    const encoder = new VideoEncoder({
        output(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
            muxer.addVideoChunk(chunk, metadata);
        },

        error(e: Error) {
            console.error(e);
            self.postMessage(<Response>{ videoError: {error: e.message } });
        }
    });

    encoder.configure(params.encoderConfig);


    // Render frames.
    //
    // Insert a keyframe every 64 frames.

    const W = params.encoderConfig.width;
    const H = params.encoderConfig.height;
    const D = 1 / (params.encoderConfig.framerate ?? 1);

    const maxFrames = params.frames;

    let lastNotify = 0;

    for (let N = 0, T = 0; N < maxFrames; N++, T += D) {
        if (N > 0 && N % 256 == 0) {
            // flush() every 256 frames to reduce memory consumption.
            await encoder.flush();
        }

        const data = vgsProgram.run(W, H, T, N, D);

        if (data === null) {
            self.postMessage(<Response>{ videoError: { error: "Render failed." } });
            break;
        }

        const buffer = data.get().slice().buffer;
        data.free();

        const frame = new VideoFrame(buffer, <any>{
            format: "BGRA",
            codedWidth: W,
            codedHeight: H,
            duration: D * 1e6,
            timestamp: T * 1e6,
            transfer: [ buffer ],
        });

        encoder.encode(frame, { keyFrame: N % 64 == 0 });
        frame.close();

        const now = performance.now();
        if (now - lastNotify > 200) {
            lastNotify = now;
            self.postMessage(<Response>{ videoProgress: { frames: N } });
        }
    }

    self.postMessage({ videoProgress: { frames: maxFrames } });


    // Create an object URL for the generated file and send it
    // to the main thread.

    await encoder.flush();
    muxer.finalize();

    const { buffer } = muxer.target;
    self.postMessage(<Response>{ videoFinish: { buffer } }, <any>[ buffer ]);
}
