declare module 'canvas' {
    export class Image {
        src: Buffer;
        onload: () => void;
    }
}

declare module 'cuint' {
    export class UINT64 {
        constructor(lowBits: number, highBits: number)
        constructor(number: number)

        div(number: UINT64): UINT64
        subtract(number: UINT64): UINT64

        clone(): UINT64
        toNumber(): number
    }
}

declare module 'data-uri-to-buffer';

declare module 'yargs' {
    export const argv: {[key: string]: string}
}