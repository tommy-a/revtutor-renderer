import { UINT64 as Uint64 } from 'cuint';
import * as logger from 'winston';
import { argv } from 'yargs';

import { ApplicationError, ErrorCode } from './application-error';
import { AttributedModification, ModificationSource } from './blaze/modification';
import { TreeDatabase } from './blaze/tree-database';
import { SessionData, SessionUpdate } from './session-data';
import { getPictures, killProcess, searchForUrls } from './util';
import { DataRetriever } from './whiteboard/data-retriever';
import { Whiteboard } from './whiteboard/whiteboard';

// setup the default logger to be used globally
logger.configure({
    transports: [new logger.transports.Console({
        colorize: true,
        prettyPrint: true,
        level: 'verbose', // max level of verbosity to log
        timestamp: true,
        handleExceptions: true,
        humanReadableUnhandledException: true,
        exitOnError: true // log and exit on uncaught exceptions
    })]
});

// main program execution loop
(async () => {
    if (argv.archiveFile === undefined) {
        killProcess(ErrorCode.InvalidInput, 'archiveFile flag not provided');
    }
    if (argv.outputDir === undefined) {
        killProcess(ErrorCode.InvalidInput, 'outputDir flag not provided');
    }

    const archiveFile = argv.archiveFile;
    const outputDir = argv.outputDir;

    logger.info('Decoding serialized updates');

    // retrieve all updates from the binary data
    let updates: SessionUpdate[] = [];
    try {
        updates = SessionData.decodeUpdates(archiveFile);
    } catch (err) {
        killProcess(ErrorCode.DecodeUpdates, err);
    }

    logger.info('Searching for all unique picture urls in blaze updates');

    // search for and download all pictures from s3 before rendering
    const urls = searchForUrls(updates);

    logger.info(`Downloading ${urls.length} picture(s)`);

    const pictures = await getPictures(urls).catch(err => {
        killProcess(ErrorCode.GetPictures, err);
    });

    // setup db and whiteboard renderer
    const blazeDb = new TreeDatabase(false);
    const whiteboard = new Whiteboard(outputDir, pictures!, new DataRetriever(blazeDb));

    logger.info('Starting frame rendering');

    // process each binary update
    let prevTimestamp = new Uint64(0);
    for (let i = 0; i < updates!.length; ++i) {
        logger.verbose(`Processing update: ${i} of ${updates!.length}`);

        const u = updates![i];
        const modification: AttributedModification = {
            source: ModificationSource.Remote,
            modification: u.modification
        };

        // calculate the duration that has passed since the previous update (in milliseconds)
        const delta = u.timestamp.clone().subtract(prevTimestamp).toNumber();
        prevTimestamp = u.timestamp;

        // increment the whiteboard's clock
        whiteboard.addDelta(delta);

        // apply the update to the db
        blazeDb.modificationSink.next(modification);

        await whiteboard.render().catch(err => {
            if (err instanceof ApplicationError) {
                killProcess(err.code, err.message);
            } else {
                killProcess(ErrorCode.RenderFail, err);
            }
        });
    }

    logger.info(`Successfully rendered all frames to ${outputDir}`);
    process.exit(0);
})();
