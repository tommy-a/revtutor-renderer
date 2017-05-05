import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import { Canvas } from 'fabric';
const { createCanvasForNode } = fabric;

import { createReadStream, createWriteStream } from 'fs';
import 'rxjs/add/operator/partition';
import { Subscription } from 'rxjs/Subscription';
import * as logger from 'winston';

import { ApplicationError, ErrorCode } from '../application-error';
import { DataRetriever, PathDrawable, PictureDrawable, WhiteboardInfo } from './data-retriever';
import { PathLayer } from './path-layer';
import { Picture } from './picture';
import { PictureLayer } from './picture-layer';

export type UrlMap = { [url: string]: Buffer };

/**
 * @class Class that listens to incremental blaze updates and renders visible changes
 * to a fabric Canvas object.  Upon adding timestamp deltas inbetween blaze updates,
 * an internal clock is incremented.  A call to render() will then use
 * this clock to either output a new frame for the most recent snapshot of the underlying
 * canvas, or overwrite the previous one if the clock has remained the same.  Copies of
 * the previous frame will also be made to maintain a frame rate of 30 fps, before writing
 * the most recent snapshot.
 */
export class Whiteboard {
    readonly fps = 30; // frame rate to adhere to when writing frames

    private outputDir: string; // directory to write frames to
    private pictureBuffers: UrlMap; // maps picture urls to their raw binary data

    private dataRetriever: DataRetriever; // generates observables for listening to blazeDb updates
    private subscription: Subscription; // a set of all active blazeDb subscriptions

    private isStarted = false; // the rendering starts when the audio starts; don't modify the clock until this is true
    private clock = 0; // the millisecond duration into the video that the whiteboard's canvas currently represents
    private timeOfLastSnapshot = 0; // a millisecond timestamp used for calculating the time between snapshots

    private pictureLayer: PictureLayer; // canvas for drawing pictures to
    private pathLayer: PathLayer; // canvas for drawing paths to; needs it's own canvas so that erasers don't erase background images
    private snapshot: Canvas; // canvas representing the current state of the whiteboard

    private frameIdx = 0; // the last frame to have been written (i.e `{frameIdx}.png`)

    constructor(outputDir: string, pictureBuffers: UrlMap, dataRetriever: DataRetriever) {
        this.outputDir = outputDir;
        this.pictureBuffers = pictureBuffers;

        this.dataRetriever = dataRetriever;
        this.subscription = new Subscription();

        this.pictureLayer = new PictureLayer();
        this.pathLayer = new PathLayer();
        this.snapshot = createCanvasForNode(0, 0);

        // start listening for updates to the blazeDb
        this.subscribe();
    }

    /**
     *  Moves the internal clock forward by a certain duration
     * @param delta - the millisecond duration
     */
    addDelta(delta: number): void {
        // only move the clock forward once the session has started
        if (!this.isStarted) {
            return;
        }

        this.clock += delta;
    }

    /**
     *  Outputs frames to outputDir for any changes that have occured since the last call, at
     * a rate of this.fps
     */
    async render(): Promise<void> {
        // only render if the whiteboard has recently been changed
        if (!this.pictureLayer.isDirty && !this.pathLayer.isDirty) {
            return;
        }

        // render a new frame for the recent changes (i.e. compose all layers)
        this.snapshot.setBackgroundImage(this.pictureLayer.dataUrl, () => this.snapshot.renderAll());
        this.snapshot.setOverlayImage(this.pathLayer.dataUrl, () => this.snapshot.renderAll());

        // check to see if these changes have occured within the same frame
        const elapsedFrames = this.getElapsedFrameCount();
        if (elapsedFrames > 0) {
            // write duplicate frames to fill the duration that has elapsed
            if (elapsedFrames > 1) {
                await this.writeElapsedFrames(elapsedFrames - 1).catch(err => {
                    throw new ApplicationError(ErrorCode.WriteFail, err);
                });
            }

            await this.writeSnapshot(++this.frameIdx).catch(err => {
                throw new ApplicationError(ErrorCode.WriteFail, err);
            });
        } else {
            // overwrite the previously written frame (i.e. don't increment this.frameIdx)
            await this.writeSnapshot(this.frameIdx).catch(err => {
                throw new ApplicationError(ErrorCode.WriteFail, err);
            });
        }

        this.timeOfLastSnapshot = this.clock;
    }

    private getElapsedFrameCount(): number {
        const duration = Math.round(this.clock - this.timeOfLastSnapshot);
        return Math.round(duration / ((1 / this.fps) * 1000));
    }

    private writeSnapshot(idx: number): Promise<{}>  {
        return new Promise(async (resolve) => {
            logger.verbose(`Rendering frame: ${idx}`);

            const file = createWriteStream(`${this.outputDir}/${idx}.png`);

            const stream = (this.snapshot as any).createPNGStream();
            stream.on('data', (chunk: any) => file.write(chunk));
            stream.on('end', () => file.end());

            file.on('close', () => resolve());
        });
    }

    // write frames at a rate of 30fps for the duration that has elapsed inbetween changes;
    // these are simply copies of the most recent frame to have been written
    private async writeElapsedFrames(count: number): Promise<{}> {
        return new Promise((resolve) => {
            logger.verbose(`Rendering elapsed frames: ${this.frameIdx + 1} - ${this.frameIdx + count}`);

            const src = `${this.outputDir}/${this.frameIdx}.png`;

            let fileCount = 0;
            for (let i = 1; i <= count; ++i) {
                const dst = `${this.outputDir}/${this.frameIdx + i}.png`;
                Whiteboard.copyFile(src, dst).then(() => {
                    if (++fileCount === count) {
                        resolve();
                    }
                });
            }

            this.frameIdx += count;
        });
    }

    private static copyFile(src: string, dst: string): Promise<{}> {
        return new Promise((resolve) => {
            const stream = createReadStream(src);
            stream.on('end', () => resolve());
            stream.pipe(createWriteStream(dst));
        });
    }

    private subscribe(): void {
        this.subscription.add(
            this.dataRetriever.listenForDimensions()
                .subscribe(info => this.onDimensions(info))
        );

        this.subscription.add(
            this.dataRetriever.listenForAudioStart()
                .subscribe(() => this.onAudioStart())
        );

        // listen for completed paths and new pictures
        const [paths, pictures] = this.dataRetriever.listenForDrawables()
            .partition(d => d.type === 'path');

        this.subscription.add(
            paths.filter((d: PathDrawable) => d.d3 !== undefined)
                .subscribe((d: PathDrawable) => this.onNewPath(d))
        );
        this.subscription.add(
            pictures.subscribe((d: PictureDrawable) => this.onNewPicture(d))
        );
    }

    private onDimensions(info: WhiteboardInfo): void {
        this.pictureLayer.setDimensions(info.canvasWidth, info.canvasHeight);
        this.pathLayer.setDimensions(info.canvasWidth, info.canvasHeight);

        this.snapshot.setWidth(info.canvasWidth);
        this.snapshot.setHeight(info.canvasHeight);
    }

    private onAudioStart(): void {
        this.isStarted = true;
    }

    private onNewPath(drawable: PathDrawable): void {
        this.pathLayer.addPath(drawable);
    }

    private onNewPicture(drawable: PictureDrawable): void {
        const picture = new Picture(drawable, this.pictureBuffers[drawable.imageURL!]);
        this.pictureLayer.addPicture(picture);

        // subscribe to future transformation updates
        this.subscription.add(
            this.dataRetriever.listenForPictureUpdate(drawable.path)
                .subscribe(d => this.onPictureUpdate(d))
        );
    }

    private onPictureUpdate(drawable: PictureDrawable): void {
        this.pictureLayer.transformPicture(drawable.key, drawable.transform);
    }
}
