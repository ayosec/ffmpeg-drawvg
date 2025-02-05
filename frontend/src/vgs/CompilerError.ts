export default interface CompilerError {
    programId: number;
    line: number;
    column: number;
    token: string;
    message: string;
}
