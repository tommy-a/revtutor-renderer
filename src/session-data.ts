import { UINT64 as Uint64 } from 'cuint';
import { readFileSync } from 'fs';
import * as logger from 'winston';

import { Modification } from './blaze/modification';
import { Update } from './blaze/update';

export interface SessionUpdate {
    timestamp: Uint64;
    modification: Modification;
}

export class SessionData {
    static decodeUpdates(archiveFile: string): SessionUpdate[] {
        const buffer = readFileSync(archiveFile);

        const updates: SessionUpdate[] = [];

        // check for correct binary version
        const version = buffer.readUInt8(0);
        if (version !== 1) {
            throw new Error(`Incorrect version for binary data: expected 1 but got ${version}`);
        }

        let offset = 1; // ignore the version byte
        while (offset < buffer.length) {
            const entryLength = buffer.readUInt32BE(offset);
            offset += 4;

            const updateIdx = offset + 4; // skip the index header
            const nextUpdateIdx = offset + entryLength;
            const timestampIdx = nextUpdateIdx - 8;

            // ignore updates of 0 length
            const updateLength = entryLength - 12;
            if (updateLength === 0) {
                offset = nextUpdateIdx;
                continue;
            }

            // decode the update
            const update: Update = JSON.parse(buffer.slice(updateIdx, timestampIdx).toString());

            // decode the timestamp
            const higherBytes = buffer.readUInt32BE(timestampIdx);
            const lowerBytes = buffer.readUInt32BE(timestampIdx + 4);
            const timestamp = new Uint64(lowerBytes, higherBytes);
            timestamp.div(new Uint64(10000)); // convert from .net ticks to milliseconds

            updates.push({
                modification: update.data,
                timestamp
            });

            offset = nextUpdateIdx;
        }

        logger.info(`${updates.length} update(s) decoded from binary file`);
        return updates;
    }
}
