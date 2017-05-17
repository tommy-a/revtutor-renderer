import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import * as logger from 'winston';

import { UrlMap } from '../util';
import { BackgroundLayer, PageType } from './background-layer';
import { Drawable, PageInfo, PathDrawable, PictureDrawable } from './data-retriever';
import { PathLayer } from './path-layer';
import { PictureLayer } from './picture-layer';

export class Page {
    private info: PageInfo;
    private pictures: UrlMap; // maps picture urls to a Picture
    private drawableTypeMap = new Map<string, string>(); // maps the id of drawables to their type => needed for when drawables are removed

    private backgroundLayer: BackgroundLayer; // canvas for drawing the PaperType background to
    private pictureLayer: PictureLayer; // canvas for drawing pictures to
    private pathLayer: PathLayer; // canvas for drawing paths to; needs it's own canvas so that erasers don't erase background images

    private backgroundSnapshot: fabric.Canvas; // canvas for caching the background + picture layer
    private snapshot: fabric.Canvas; // canvas representing the current state of the page

    constructor(info: PageInfo, width: number, height: number, pictures: UrlMap) {
        this.info = info;
        this.pictures = pictures;

        this.backgroundLayer = new BackgroundLayer(width, height, info.paperType);
        this.pictureLayer = new PictureLayer(width, height);
        this.pathLayer = new PathLayer(width, height);

        this.backgroundSnapshot = fabric.createCanvasForNode(width, height);
        this.snapshot = fabric.createCanvasForNode(width, height);
    }

    get key(): string {
        return this.info.key;
    }

    get isDirty(): boolean {
        return (this.pathLayer.isDirty || this.pictureLayer.isDirty || this.backgroundLayer.isDirty);
    }

    updatePageInfo(info: PageInfo) {
        this.backgroundLayer.setPageType(info.paperType);
    }

    async getSnapshot(): Promise<fabric.Canvas> {
        if (this.isDirty) {
            await this.composeLayers();
        }

        return this.snapshot;
    }

    public onAddedDrawable(d: Drawable): void {
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

    public onChangedDrawable(d: Drawable): void {
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

    public onRemovedDrawable(key: string): void {
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

    private async composeLayers(): Promise<void> {
        this.snapshot.clear();

        if (this.backgroundLayer.isDirty) {
            Page.setBackground(this.backgroundSnapshot, this.backgroundLayer.dataUrl);
        }
        if (this.pictureLayer.isDirty) {
            Page.setForeground(this.backgroundSnapshot, this.pictureLayer.dataUrl);
        }

        this.snapshot.add(await Page.imageFromURL(this.backgroundSnapshot.toDataURL()));
        this.snapshot.add(await Page.imageFromURL(this.pathLayer.dataUrl));
    }

    static async imageFromURL(url: string): Promise<fabric.Image> {
        return new Promise<fabric.Image>((resolve) => {
            fabric.Image.fromURL(url, image => resolve(image));
        });
    }

    static async setBackground(canvas: fabric.Canvas, imageUrl: string): Promise<void> {
        return new Promise<void>((resolve) => {
            canvas.setBackgroundImage(imageUrl, () => resolve());
        });
    }

    static async setForeground(canvas: fabric.Canvas, imageUrl: string): Promise<void> {
        return new Promise<void>((resolve) => {
            canvas.setOverlayImage(imageUrl, () => resolve());
        });
    }
}
