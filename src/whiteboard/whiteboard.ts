import { createReadStream, createWriteStream } from 'fs';
import 'rxjs/add/operator/partition';
import { Subscription } from 'rxjs/Subscription';
import * as logger from 'winston';

import { ApplicationError, ErrorCode } from '../application-error';
import { TreeDataEventType } from '../blaze/tree-data-event';
import { UrlMap } from '../util';
import { BackgroundLayer } from './background-layer';
import { DataRetriever, Drawable, MemberInfo, PageInfo, PathDrawable, PictureDrawable, SessionMemberRole, WhiteboardInfo } from './data-retriever';
import { Page } from './page';
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

    private whiteboardInfo: WhiteboardInfo; // currently only used to obtain the intial dimensions
    private pages = new Map<string, Page>(); // maps page keys to their respective Page objects
    private currentPage: Page; // current page of the whiteboard, from the student's perspective

    private isStarted = false; // the rendering starts when the audio starts; don't modify the clock until this is true
    private hasPageChanged = false; // has the student's active page changed => need to re-render if so

    private clock = 0; // the millisecond duration into the video that the whiteboard's canvas currently represents
    private frameIdx = 0; // the last frame to have been written (i.e `{frameIdx}.png`)

    constructor(outputDir: string, pictures: UrlMap, dataRetriever: DataRetriever) {
        this.outputDir = outputDir;
        this.pictures = pictures;

        this.dataRetriever = dataRetriever;
        this.subscription = new Subscription();

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
        // only render if the whiteboard page has recently been modified or switched to a different page
        if (!(this.currentPage && this.currentPage.isDirty) && !this.hasPageChanged) {
            return;
        }

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

        this.hasPageChanged = false;
    }

    private getElapsedFrameCount(): number {
        const totalFrames = this.clock / ((1 / this.fps) * 1000);
        return Math.floor(totalFrames - this.frameIdx);
    }

    private writeSnapshot(idx: number): Promise<{}>  {
        return new Promise(async (resolve) => {
            logger.verbose(`Rendering frame: ${idx}`);

            const file = createWriteStream(`${this.outputDir}/${idx}.png`);

            const stream = (await this.currentPage.getSnapshot() as any).createPNGStream();
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
            this.dataRetriever.listenForPageUpdates()
                .subscribe(info => this.onPageUpdate(info))
        );

        this.subscription.add(
            this.dataRetriever.listenForAudioStart()
                .subscribe(() => this.onAudioStart())
        );

        this.subscription.add(
            this.dataRetriever.listenForMemberInfoUpdates()
                .filter(info => info.role === SessionMemberRole.Student)
                .subscribe(info => this.onStudentUpdate(info))
        );
    }

    private onWhiteboardInfo(info: WhiteboardInfo): void {
        this.whiteboardInfo = info;
    }

    private onAudioStart(): void {
        this.isStarted = true;
    }

    private onPageUpdate(info: PageInfo) {
        try {
            const page = this.pages.get(info.key);
            if (!page) {
                this.createNewPage(info);
            } else {
                page.updatePageInfo(info);
            }
        } catch (err) {
            logger.error(err);
            throw(err);
        }
    }

    private onStudentUpdate(info: MemberInfo): void {
        if (!info.currentPageFirebase) {
            return;
        }

        const newPage = this.pages.get(info.currentPageFirebase);
        if (newPage) {
            this.setCurrentPage(newPage);
        }
    }

    private createNewPage(info: PageInfo): void {
        const page = new Page(info, this.whiteboardInfo.canvasWidth, this.whiteboardInfo.canvasHeight, this.pictures);
        this.pages.set(info.key, page);
        this.subscribeToPage(page);

        // this assignment is needed because the pages are initialized before the student connects,
        // and the video starts rendering as soon as the tutor's audio starts
        if (this.frameIdx === 0) {
            this.setCurrentPage(page);
        }
    }

    private setCurrentPage(page: Page) {
        this.currentPage = page;
        this.hasPageChanged = true;
    }

    private subscribeToPage(page: Page): void {
        this.subscription.add(
            this.dataRetriever.listenForAddedDrawables(page.key)
                .filter((d: PathDrawable & PictureDrawable) =>
                            d.d2 !== undefined || d.d3 !== undefined || d.imageURL !== undefined)
                .subscribe(d => page.onAddedDrawable(d))
        );

        this.subscription.add(
            this.dataRetriever.listenForChangedDrawables(page.key)
                .filter((d: PathDrawable & PictureDrawable) =>
                                d.d2 !== undefined || d.d3 !== undefined || d.imageURL !== undefined)
                .subscribe(d => page.onChangedDrawable(d))
        );

        this.subscription.add(
            this.dataRetriever.listenForRemovedDrawables(page.key)
                .subscribe(k => page.onRemovedDrawable(k))
        );
    }
}
