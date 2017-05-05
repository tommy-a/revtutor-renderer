import * as https from 'https';
import * as logger from 'winston';

import { ErrorCode } from './application-error';
import { SessionUpdate } from './session-data';
import { UrlMap } from './whiteboard/whiteboard';

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
 * Downloads the binary data for a given set of https url strings
 * @param urls - an array of url strings
 * @returns a Promise<UrlMap> that maps urls to their respective Buffer
 */
export async function getPictureBuffers(urls: string[]): Promise<UrlMap> {
    return new Promise<UrlMap>(async (resolve) => {
        const buffers: UrlMap = {};

        urls.forEach(url => {
            https.get(url, (response) => {
                const chunks: Buffer[] = [];

                response.on('data', (c: Buffer) => {
                    chunks.push(c);
                });

                response.on('end', () => {
                    buffers[url] = Buffer.concat(chunks);

                    if (Object.keys(buffers).length === urls.length) {
                        resolve(buffers);
                    }
                });
            });
        });
    });
}
