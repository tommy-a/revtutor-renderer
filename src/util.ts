import * as Canvas from 'canvas';
import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import * as https from 'https';
import * as logger from 'winston';

import { ErrorCode } from './application-error';
import { SessionUpdate } from './session-data';
import { Picture } from './whiteboard/picture';

export type UrlMap = Map<string, Picture>;

/**
 * Logs an error message and exits the main program with a given ErrorCode
 * @param code - the ErrorCode to exit with
 * @param message - an associated error message to log
 */
export function killProcess(code: ErrorCode, message: any): void {
    logger.error(message);
    process.exit(code);
}

/**
 * Searches an array of decoded blaze updates for all unique picture src urls (only https) that exist
 * @param updates - an array of SessionUpdates ordered by increasing timestamp
 * @returns an array of url strings
 */
export function searchForUrls(updates: SessionUpdate[]): string[] {
    const urls: string[] = [];

    updates.filter(u => u.modification.path.indexOf('drawablesData') !== undefined)
        .forEach(u => {
            // search for SetValue modifications that set imageUrl directly
            let value = (u.modification as any).value;
            if (typeof value === 'string' && value.indexOf('https') === 0) {
                urls.push(value);
            }

            // search for the initial UpdateValue modification for the first picture
            const values = (u.modification as any).values;
            if (values) {
                Object.keys(values).forEach((key: string) => {
                    value = values[key];
                    if (typeof value === 'string' && value.indexOf('https') === 0) {
                        urls.push(value);
                    }
                });
            }
        });

    return urls;
}

/**
 * Downloads the binary data for a given set of https url strings, and
 * creates a Picture object for each one
 * @param urls - an array of url strings
 * @returns a Promise<UrlMap> that maps urls to their respective Picture object
 */
export async function getPictures(urls: string[]): Promise<UrlMap> {
    const pictures: UrlMap = new Map<string, Picture>();

    for (const url of urls) {
        const buffer = await getImageBuffer(url);
        const image = await loadImage(buffer);
        const picture = new Picture(buffer, image);

        pictures.set(url, picture);
    }

    return pictures;
}

/**
 * Downloads the binary data for a given url
 * @param url - the https url string of the image to download
 * @returns a Promise<Buffer> that resolves to the downloaded buffer
 */
export async function getImageBuffer(url: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
        https.get(url, (response) => {
            const chunks: Buffer[] = [];

            response.on('data', (c: Buffer) => {
                chunks.push(c);
            });

            response.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });
    });
}

/**
 * Creates a fabric image from an underlying binary buffer
 * @param buffer - the src binary data to initialize the image with
 * @returns a Promise<fabric.Image> that resolves to the loaded image
 */
export async function loadImage(buffer: Buffer): Promise<fabric.Image> {
    return new Promise<fabric.Image>((resolve) => {
        const canvas = new Canvas.Image();

        canvas.onload = () => {
            resolve(new fabric.Image(canvas as any, {}));
        };

        canvas.onerror = (err) => { throw err; };

        canvas.src = buffer;
    });
}
