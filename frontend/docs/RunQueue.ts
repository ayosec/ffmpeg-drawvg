import fs from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir, cpus } from "node:os";

const MAX_JOBS = Math.min(8, cpus().length);

interface Job {
    command: string[];
    resolve(): void;
}

export default class RunQueue {
    runningJobs = 0;
    pending: Job[];
    logFile: fs.WriteStream | null;

    constructor() {
        this.runningJobs = 0;
        this.pending = [];
        this.logFile = null;
    }

    launch(command: string[]) {
        return new Promise<void>((resolve) => {
            this.pending.push({ command, resolve });
            this.queuePending();
        });
    }

    private queuePending() {
        if (this.runningJobs >= MAX_JOBS) {
            return;
        }

        const nextJob = this.pending.shift();
        if (nextJob === undefined)
            return;

        const [program, ...args] = nextJob.command;

        if (this.logFile === null)
            this.logFile = makeLogFile();

        const child = spawn(program, args, {
            timeout: 120000,
            killSignal: "SIGKILL",
        });

        this.logFile.write(`[${child.pid}] ${JSON.stringify([program, ...args])}\n`);

        this.runningJobs++;

        child.stdin.end();

        child.on("close", (code) => {
            if (code !== 0) {
                const logPath = this.logFile?.path;
                this.logFile?.close();
                this.logFile = null;

                console.error("JOBS: Command failed:", nextJob.command);

                if (logPath) {
                    console.log(fs.readFileSync(logPath, "utf8"));
                }

                process.exit(1);
            }

            this.runningJobs--;
            this.queuePending();

            nextJob.resolve();
        });

        for (const stream of [child.stdout, child.stderr]) {
            stream.on("data", (data) => {
                for (const line of data.toString().split("\n"))
                    this.logFile?.write(`[${child.pid}] ${line}\n`);
            });
        }
    }
}

function makeLogFile() {
    const filename = `${tmpdir()}/playground-docs-${+new Date}.log`;
    console.info("JOBS: Output from commands in ", filename);

    return fs.createWriteStream(filename);
}
