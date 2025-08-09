import { useEffect, useRef, useState } from "react";

import outputStyles from "../output.module.css";
import styles from "../../base/dialog.module.css";
import { Configuration } from "./VideoExport";

interface ConfigureProps {
    size: [ number, number ];
    setConfig: (config: Configuration) => void;
    onClose: () => void;
};

interface TextInputProps {
    name: string;
    placeholder: string;
    defaultValue: string;
}

const HasVideoEncoder = "VideoEncoder" in window;

// Bitrates values are taken from https://developers.google.com/media/vp9/settings/vod/

async function loadConfiguration(data: FormData): Promise<Configuration|null> {
    const form: {[key: string]: string} = {};
    for (const [ field, value ] of data.entries()) {
        form[field] = value.toString();
    }

    const frameCount = parseFloat(
        form.frameCount === "custom"
            ? form.customDuration
            : form.frameCount
    );

    const colorFormat = form.colorFormat;
    const isYUV444 = colorFormat === "yuv444";

    let codec;
    switch (form.codec) {
        case "av01":
            codec = `av01.${isYUV444 ? 1 : 0}.15M.08.0.${isYUV444 ? "000" : "110"}.01.01.01.0`;
            break;

        case "vp08":
            if (isYUV444)
                return null;

            codec = "vp8";
            break;

        case "vp09":
            if (isYUV444)
                return null;

            codec = "vp09.02.10.10";
            break;

        default:
            return null;
    }

    const dimensions = /^\s*(\d+)\s*x\s*(\d+)$/
        .exec(form.size == "custom" ? form.customSize : form.size);

    if (dimensions === null)
        return null;

    const width = parseFloat(dimensions[1]);
    const height = parseFloat(dimensions[2]);

    const bitrate = parseFloat(form.bitrate);
    const bitrateMode = form.bitrateMode as VideoEncoderBitrateMode;

    const framerate = parseFloat(form.framerate ?? "1");

    const encoderConfig: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        bitrateMode,
        framerate,
    };

    if ((await VideoEncoder.isConfigSupported(encoderConfig)).supported !== true)
        return null;

    return { encoderConfig, frameCount };
}

function Param({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div className={styles.param}>
            <label><span>{label}</span>{children}</label>
        </div>
    );
}

function TextInput({ name, placeholder, defaultValue }: TextInputProps) {
    return (
        <input
            name={name}
            autoFocus={true}
            spellCheck={false}
            style={{width: "10ch"}}
            placeholder={placeholder}
            defaultValue={defaultValue}
        />
    );
}

function DurationWarning() {
    return (
        <div className={outputStyles.warning}>
            <b>Warning</b>

            The video will be stored in the memory of the browser.
            The process to render a long video can consume many
            hardware resources.
        </div>
    );
}

export default function Configure({ size, setConfig, onClose }: ConfigureProps) {
    const [ showCustomSize, setShowCustomSize ] = useState(false);

    const [ showCustomDuration, setShowCustomDuration ] = useState(false);

    const [ computedDuration, setComputedDuration ] = useState(0);

    const [ failureMessage, setFailureMessage ] = useState<React.ReactNode>(null);

    const dialogRef = useRef<HTMLDialogElement>(null);

    const formRef = useRef<HTMLFormElement>(null);

    const debounceCheckConf = useRef<ReturnType<typeof setTimeout>>(null);

    const checkConfiguration = () => {
        if (debounceCheckConf.current !== null)
            clearTimeout(debounceCheckConf.current);

        debounceCheckConf.current = setTimeout(() => {
            debounceCheckConf.current = null;

            if (formRef.current === null)
                return;

            const data = new FormData(formRef.current);

            loadConfiguration(data).then(config => {
                if (config === null) {
                    setFailureMessage("This configuration is not supported by the browser.");
                    return;
                }

                setFailureMessage(null);

                const duration = config.frameCount / config.encoderConfig.framerate!;
                setComputedDuration(isFinite(duration) ? duration : 0);
            });
        }, 50);
    };

    const startExport = (data: FormData) => {
        loadConfiguration(data).then(config => {
            if (config === null) {
                setFailureMessage("Unable to start the video encoder.");
            } else {
                setConfig(config);
            }
        });
    };

    useEffect(() => { dialogRef.current?.showModal(); }, []);

    useEffect(checkConfiguration, []);

    if (!HasVideoEncoder && failureMessage === null) {
        setFailureMessage(<>
            <a
                target="_blank"
                href="https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/VideoEncoder"
            >
                <code>VideoEncoder</code>
            </a> is not available in this browser.
        </>);
    }

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={onClose}
        >
            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    <h1>Export to Video</h1>

                    <div className={styles.details}>
                        Render {" "}
                        <b>{Math.round(computedDuration)} seconds</b>
                        {" "} of the current script to produce a WebM file.
                    </div>

                    { failureMessage && <div className={styles.errors}>{failureMessage}</div> }

                    { computedDuration > 10 && <DurationWarning /> }
                </div>

                <form
                    ref={formRef}
                    action={startExport}
                    className={styles.content + " " + styles.verticalForm}
                    onChange={checkConfiguration}
                >
                    <Param label="Number of Frames">
                        <select
                            name="frameCount"
                            defaultValue="600"
                            onChange={e => {
                                setShowCustomDuration(e.target.value === "custom");
                            }}
                        >
                            <option value="custom">Custom</option>
                            <option>300</option>
                            <option>600</option>
                            <option>1200</option>
                            <option>6000</option>
                        </select>

                        {
                            showCustomDuration &&
                                <TextInput
                                    name="customDuration"
                                    defaultValue="60"
                                    placeholder="Frames"
                                />
                        }
                    </Param>

                    <Param label="Size">
                        <select
                            name="size"
                            defaultValue="640x360"
                            onChange={e => {
                                setShowCustomSize(e.target.value === "custom");
                            }}
                        >
                            <option value="custom">Custom</option>
                            <option>320x240</option>
                            <option>640x360</option>
                            <option>1024x768</option>
                            <option>1920x1080</option>
                        </select>

                        {
                            showCustomSize &&
                                <TextInput
                                    name="customSize"
                                    defaultValue={size.join("x")}
                                    placeholder="WxH"
                                />
                        }
                    </Param>

                    <Param label="Framerate">
                        <select defaultValue="60" name="framerate">
                            <option value="12">12 FPS</option>
                            <option value="24">24 FPS</option>
                            <option value="30">30 FPS</option>
                            <option value="60">60 FPS</option>
                            <option value="90">90 FPS</option>
                        </select>
                    </Param>

                    <Param label="Bitrate">
                        <select name="bitrate" defaultValue="6000000">
                            <option value="1000000">1000 kbps</option>
                            <option value="3000000">3000 kbps</option>
                            <option value="6000000">6000 kbps</option>
                            <option value="9000000">9000 kbps</option>
                        </select>

                        <select name="bitrateMode" defaultValue="variable">
                            <option value="constant">Constant</option>
                            <option value="variable">Variable</option>
                        </select>
                    </Param>

                    <Param label="Codec">
                        <select defaultValue="vp08" name="codec">
                            <option value="vp08">VP8</option>
                            <option value="vp09">VP9</option>
                            <option value="av01">AV1</option>
                        </select>
                    </Param>

                    <Param label="Chroma Subsampling">
                        <select name="colorFormat" defaultValue="yuv420">
                            <option value="yuv420">YUV 4:2:0</option>
                            <option value="yuv444">YUV 4:4:4</option>
                        </select>
                    </Param>

                    <div className={styles.actions}>
                        <button className={styles.close} formAction={onClose}>Close</button>

                        <button className={styles.submit} disabled={failureMessage !== null}>
                            Export
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}
