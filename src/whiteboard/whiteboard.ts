import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import { Canvas } from 'fabric';
const { createCanvasForNode } = fabric;

import 'rxjs/add/operator/partition';
import { createReadStream, createWriteStream } from 'fs';
import { Subscription } from 'rxjs/Subscription';

import { PathDrawable, PictureDrawable, DataRetriever, WhiteboardInfo } from './data-retriever';
import { Picture } from './picture';
import { PathLayer } from './path-layer';
import { PictureLayer } from './picture-layer';
import { TreeDatabase } from '../blaze/tree-database';

export type UrlMap = { [url: string]: Buffer };

export class Whiteboard {
    readonly basePath = '/Users/tommy/Documents/revtutor-renderer/snapshots';
    readonly fps = 30;

    private dataRetriever: DataRetriever; // generates observables for listening to blazeDb updates
    private subscription = new Subscription(); // a set of all active blazeDb subscriptions

    private pictureBuffers: UrlMap = {}; // maps picture urls to their raw binary data

    private isStarted = false; // the rendering starts when the audio starts; don't modify the clock until this is true
    private clock = 0; // the millisecond duration into the video that the whiteboard currently represents
    private timeOfLastSnapshot = 0; // a millisecond timestamp used for calculating the time between snapshots

    private pictureLayer: PictureLayer; // canvas for drawing pictures to
    private pathLayer: PathLayer; // canvas for drawing paths to; needs it's own canvas so that erasers don't erase background images
    private snapshot: Canvas; // canvas representing the current state of the whiteboard

    private frameIdx = 0; // the previous frame to have been output

    constructor(blazeDb: TreeDatabase, pictureBuffers: UrlMap) {
        this.dataRetriever = new DataRetriever(blazeDb);
        this.pictureBuffers = pictureBuffers;

        this.pictureLayer = new PictureLayer();
        this.pathLayer = new PathLayer();
        this.snapshot = createCanvasForNode(0, 0);

        // start listening for updates to the blazeDb
        this.subscribe();
    }

    // move the clock forward by a millisecond duration
    addDelta(delta: number): void {
        // only move the clock forward once the session has started
        if (!this.isStarted) {
            return;
        }

        this.clock += delta;
    }

    async takeSnapshot(): Promise<void> {
        // only take a snapshot if the whiteboard has recently been changed
        if (!this.pictureLayer.isDirty && !this.pathLayer.isDirty) {
            return;
        }

        // output the frames that precede this new snapshot
        await this.writeFrames();

        // compose the most recent snapshot (i.e. combine all layers)
        this.snapshot.setBackgroundImage(this.pictureLayer.dataUrl, () => this.snapshot.renderAll());
        this.snapshot.setOverlayImage(this.pathLayer.dataUrl, () => this.snapshot.renderAll());

        // output the newly rendered snapshot image
        await this.writeSnapshot();

        this.timeOfLastSnapshot = this.clock;
    }

    // generate frames at a rate of 30fps for the duration that has elapsed inbetween snapshots;
    // these are simply duplicate images of the previous snapshot to maintain a certain FPS
    private async writeFrames(): Promise<void> {
        const frameCount = this.getElapsedFrameCount();

        for (let i = 0; i < frameCount - 1; ++i) {
            await Whiteboard.copyFile(`${this.basePath}/${this.frameIdx}.png`, `${this.basePath}/${++this.frameIdx}.png`);
        }
    }

    private writeSnapshot(): Promise<{}>  {
        return new Promise(async (resolve) => {
            // check to see if this snapshot occurs in the same frame
            if (this.getElapsedFrameCount() > 0) {
                this.frameIdx++;
            }

            const file = createWriteStream(`${this.basePath}/${this.frameIdx}.png`);
            const stream = (this.snapshot as any).createPNGStream();

            stream.on('data', (chunk: any) => file.write(chunk));
            stream.on('end', () => file.end());

            file.on('close', () => resolve());
        });
    }

    private getElapsedFrameCount(): number {
        const duration = Math.round(this.clock - this.timeOfLastSnapshot);
        return Math.round(duration / ((1 / this.fps) * 1000));
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
