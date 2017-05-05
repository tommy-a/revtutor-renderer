export enum ErrorCode {
    Uncaught = 1, // node's default error code
    InvalidInput = 2,
    DecodeUpdates = 3,
    GetPictureBuffers = 4,
    RenderFail = 5,
    WriteFail = 6
}

export class ApplicationError extends Error {
    constructor(readonly code: ErrorCode, message: string) {
        super(message);
        Object.setPrototypeOf(this, ApplicationError.prototype);
    }
}
