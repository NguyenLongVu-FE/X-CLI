export class XCliError extends Error {
    code;
    exitCode;
    details;
    constructor(code, message, exitCode = 1, details) {
        super(message);
        this.code = code;
        this.exitCode = exitCode;
        this.details = details;
        this.name = 'XCliError';
    }
}
