import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;

import { createReadStream, createWriteStream } from 'fs';
import 'rxjs/add/operator/partition';
import { Subscription } from 'rxjs/Subscription';
import * as logger from 'winston';

import { ApplicationError, ErrorCode } from '../application-error';
import { TreeDataEventType } from '../blaze/tree-data-event';
import { UrlMap } from '../util';
import { BackgroundLayer } from './background-layer';
import { DataRetriever, Drawable, PathDrawable, PictureDrawable, WhiteboardInfo } from './data-retriever';
import { PathLayer } from './path-layer';
import { Picture } from './picture';
import { PictureLayer } from './picture-layer';

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
    private pictures: UrlMap; // maps picture urls to a Picture

    private dataRetriever: DataRetriever; // generates observables for listening to blazeDb updates
    private subscription: Subscription; // a set of all active blazeDb subscriptions
    private drawableTypeMap = new Map<string, string>(); // maps the id of drawables to their type => needed for when drawables are removed

    private isStarted = false; // the rendering starts when the audio starts; don't modify the clock until this is true
    private clock = 0; // the millisecond duration into the video that the whiteboard's canvas currently represents

    private backgroundLayer: BackgroundLayer; // canvas for drawing the PaperType background to
    private pictureLayer: PictureLayer; // canvas for drawing pictures to
    private pathLayer: PathLayer; // canvas for drawing paths to; needs it's own canvas so that erasers don't erase background images
    private snapshot: fabric.Canvas; // canvas representing the current state of the whiteboard

    private frameIdx = 0; // the last frame to have been written (i.e `{frameIdx}.png`)

    constructor(outputDir: string, pictures: UrlMap, dataRetriever: DataRetriever) {
        this.outputDir = outputDir;
        this.pictures = pictures;

        this.dataRetriever = dataRetriever;
        this.subscription = new Subscription();

        this.backgroundLayer = new BackgroundLayer();
        this.pictureLayer = new PictureLayer();
        this.pathLayer = new PathLayer();
        this.snapshot = fabric.createCanvasForNode(0, 0);

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
        await this.composeLayers();

        // check to see if these changes have occured within the same frame
        const elapsedFrames = this.getElapsedFrameCount();
        if (elapsedFrames > 0) {
            // write duplicate frames to fill the duration that has elapsed up to the new snapshot
            if (elapsedFrames > 1) {
                await this.writeElapsedFrames(elapsedFrames - 1).catch(err => {
                    throw new ApplicationError(ErrorCode.WriteFail, err);
                });
            }

            // write to a new frame
            await this.writeSnapshot(++this.frameIdx).catch(err => {
                throw new ApplicationError(ErrorCode.WriteFail, err);
            });
        } else {
            // overwrite the previously written frame
            await this.writeSnapshot(this.frameIdx).catch(err => {
                throw new ApplicationError(ErrorCode.WriteFail, err);
            });
        }
    }

    private getElapsedFrameCount(): number {
        const totalFrames = this.clock / ((1 / this.fps) * 1000);
        return Math.floor(totalFrames - this.frameIdx);
    }

    private async composeLayers(): Promise<void> {
        this.snapshot.clear();

        this.snapshot.add(await Whiteboard.imageFromURL(this.backgroundLayer.dataUrl));
        this.snapshot.add(await Whiteboard.imageFromURL(this.pictureLayer.dataUrl));
        this.snapshot.add(await Whiteboard.imageFromURL(this.pathLayer.dataUrl));
    }

    static async imageFromURL(url: string): Promise<fabric.Image> {
        return new Promise<fabric.Image>((resolve) => {
            fabric.Image.fromURL(url, image => resolve(image));
        });
    }

    private writeSnapshot(idx: number): Promise<{}>  {
        return new Promise(async (resolve) => {
            logger.verbose(`Rendering frame: ${idx}`);

            const file = createWriteStream(`${this.outputDir}/${idx}.png`);

            const stream = (this.snapshot as any).createPNGStream();
            stream.on('data', (chunk: any) => file.write(chunk));
            stream.on('end', () => file.end());

            file.on('close', resolve);
        });
    }

    // write frames at a rate of 30fps for the duration that has elapsed inbetween changes;
    // these are simply copies of the most recent frame to have been written
    private async writeElapsedFrames(count: number): Promise<{}> {
        return new Promise(async (resolve) => {
            logger.verbose(`Rendering elapsed frames: ${this.frameIdx + 1} - ${this.frameIdx + count}`);

            const src = `${this.outputDir}/${this.frameIdx}.png`;
            for (let i = 1; i <= count; ++i) {
                const dst = `${this.outputDir}/${this.frameIdx + i}.png`;
                await Whiteboard.copyFile(src, dst);
            }

            this.frameIdx += count;
            resolve();
        });
    }

    private static copyFile(src: string, dst: string): Promise<{}> {
        return new Promise((resolve) => {
            const stream = createReadStream(src);
            stream.on('end', resolve);
            stream.pipe(createWriteStream(dst));
        });
    }

    private subscribe(): void {
        this.subscription.add(
            this.dataRetriever.listenForWhiteboardInfo()
                .subscribe(info => this.onWhiteboardInfo(info))
        );

        this.subscription.add(
            this.dataRetriever.listenForPages()
                .subscribe(key => this.onNewPage(key))
        );

        this.subscription.add(
            this.dataRetriever.listenForAudioStart()
                .subscribe(() => this.onAudioStart())
        );
    }

    private onWhiteboardInfo(info: WhiteboardInfo): void {
        try {
            // set new dimensions for all layers + snapshot canvas
            this.backgroundLayer.setDimensions(info.canvasWidth, info.canvasHeight);
            this.pictureLayer.setDimensions(info.canvasWidth, info.canvasHeight);
            this.pathLayer.setDimensions(info.canvasWidth, info.canvasHeight);
            this.snapshot.setWidth(info.canvasWidth);
            this.snapshot.setHeight(info.canvasHeight);

            // draw the background for the first page
            const key = Object.keys(info.pages)[0];
            const pageInfo = info.pages[key];
            this.backgroundLayer.setPageType(pageInfo.paperType);
        } catch (err) {
            logger.error(err);
            throw(err);
        }
    }

    private onNewPage(pageKey: string): void {
        this.subscription.add(
            this.dataRetriever.listenForAddedDrawables(pageKey)
                .filter((d: PathDrawable & PictureDrawable) =>
                            d.d2 !== undefined || d.d3 !== undefined || d.imageURL !== undefined)
                .subscribe(d => this.onAddedDrawable(d))
        );

        this.subscription.add(
            this.dataRetriever.listenForChangedDrawables(pageKey)
                .filter((d: PathDrawable & PictureDrawable) =>
                                d.d2 !== undefined || d.d3 !== undefined || d.imageURL !== undefined)
                .subscribe(d => this.onChangedDrawable(d))
        );

        this.subscription.add(
            this.dataRetriever.listenForRemovedDrawables(pageKey)
                .subscribe(key => this.onRemovedDrawable(key))
        );
    }

    private onAudioStart(): void {
        this.isStarted = true;
    }

    private onAddedDrawable(d: Drawable): void {
        try {
            this.drawableTypeMap.set(d.key, d.type!);

            if (d.type === 'path') {
                this.pathLayer.drawPath(d as PathDrawable);
            } else {
                this.addPicture(d as PictureDrawable);
            }
        } catch (err) {
            logger.error(err);
            throw(err);
        }
    }

    private onChangedDrawable(d: Drawable): void {
        try {
            this.drawableTypeMap.set(d.key, d.type!);

            if (d.type === 'path') {
                this.pathLayer.drawPath(d as PathDrawable);
            } else {
                const drawable = d as PictureDrawable;

                if (!this.pictureLayer.hasPicture(drawable.imageURL!)) {
                    this.addPicture(drawable);
                } else {
                    this.pictureLayer.transformPicture(drawable);
                }
            }
        } catch (err) {
            logger.error(err);
            throw(err);
        }
    }

    private onRemovedDrawable(key: string): void {
        try {
            const type = this.drawableTypeMap.get(key);
            if (type === 'path') {
                this.pathLayer.removePath(key);
            } else {
                this.pictureLayer.removePicture(key);
            }
        } catch (err) {
            logger.error(err);
            throw(err);
        }
    }

    private addPicture(d: PictureDrawable): void {
        const picture = this.pictures.get(d.imageURL!)!;
        picture.setDrawable(d);
        this.pictureLayer.addPicture(picture);
    }
}
