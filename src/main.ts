import * as https from 'https';
import * as Redis from 'ioredis';

import { AttributedModification, ModificationSource } from './blaze/modification';
import { TreeDatabase } from './blaze/tree-database';
import { Update } from './blaze/update';
import { Whiteboard, UrlMap } from './whiteboard/whiteboard';

const sessionToken = 's6C3D';

// connect to redis
const redis = new Redis({
    host: 'redis-test.1hawek.ng.0001.usw2.cache.amazonaws.com',
    port: 6379,
    db: 3
});

// process all incremental updates so far for a particular session
const redisKey = `test:tutoring:session:${sessionToken}`;
redis.llen(redisKey, (errA: object, count: number) => {
    return redis.lrangeBuffer(redisKey, 1, count, (errB: object, res: Buffer[]) => record(res));
});

// main execution loop
async function record(binary: Buffer[]) {
    let prevTicks = 0;

    // decode all updates from the binary data
    const updates = decodeUpdates(binary);
    const timestamps = decodeTimestamps(binary);

    // search for and download all pictures from s3 before rendering
    const urls = searchForUrls(updates);
    const pictureBuffers = await getPictureBuffers(urls);

    // setup db and whiteboard renderer
    const blazeDb = new TreeDatabase(false);
    const whiteboard = new Whiteboard(blazeDb, pictureBuffers);

    // process each binary update
    for (let i = 0; i < binary.length; ++i) {
        const update = updates[i];
        const ticks = timestamps[i];

        const modification: AttributedModification = {
            source: ModificationSource.Remote,
            modification: update.data
        };

        // calculate the duration that has passed since the previous update (in milliseconds)
        const delta = prevTicks ? ticks - prevTicks : 0;
        prevTicks = ticks;

        // increment the whiteboard's clock
        whiteboard.addDelta(delta);

        // apply the update to the db
        blazeDb.modificationSink.next(modification);

        await whiteboard.takeSnapshot();
    }

    // TODO: get the snapshot filenames, and pipe them to FFMPEG

    console.log('success!');
    process.exit(0);
}

function decodeUpdates(binary: Buffer[]): Update[] {
    return binary.map(buffer => JSON.parse(buffer.slice(4, buffer.length - 8).toString()));
}

function decodeTimestamps(binary: Buffer[]): number[] {
    return binary.map(buffer => {
        // use lower bytes of timestamp for diffing with prev timestamp;
        // this is to avoid having to operate on uint64, which JS doesn't support
        // TODO: handle the case of overflow
        const bytes = buffer.slice(buffer.byteLength - 4);
        return bytes.readUInt32BE(0) / 10000; // convert from .net ticks to milliseconds
    });
}

// TODO: parallelize this
function searchForUrls(updates: Update[]): string[] {
    const urls: string[] = [];

    updates.filter(u => u.data.path.indexOf('drawablesData') !== undefined)
        .forEach(u => {
            // search for SetValue updates that set imageUrl directly
            let value = (u.data as any).value;
            if (typeof value === 'string' && value.indexOf('https') === 0) {
                urls.push(value);
            }

            // search for the initial UpdateValue for the first picture
            const values = (u.data as any).values;
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

async function getPictureBuffers(urls: string[]): Promise<UrlMap> {
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
