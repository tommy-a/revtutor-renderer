import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import { Canvas } from 'fabric';
const { createCanvasForNode } = fabric;

/**
 * @class Helper class for initializing, modifying, and accessing the content of
 *  a fabric Canvas object
 */
export class CanvasLayer {
    /**
     * @property The underlying canvas that is drawn to
     */
    get canvas() { return this._canvas; }
    protected _canvas: Canvas;

    /**
     * @property Width in pixels of the underlying canvas
     */
    get width(): number { return this.canvas.getWidth(); }

    /**
     * @property Height in pixels of the underlying canvas
     */
    get height(): number { return this.canvas.getHeight(); }

    /**
     * @property Whether or not the canvas has been modified since the last call to dataUrl()
     */
    get isDirty() { return this._isDirty; }
    protected _isDirty = false; // has the canvas been modified

    constructor(width: number, height: number) {
        this._canvas = createCanvasForNode(width, height);
    }

    /**
     * @property Resets _isDirty to false, and returns a base64 data uri string representing
     * the contents of the underlying canvas
     */
    get dataUrl(): string {
        this._isDirty = false;
        return this.canvas.toDataURL();
    }
}
