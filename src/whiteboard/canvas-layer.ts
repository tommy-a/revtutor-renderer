import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import { Canvas } from 'fabric';
const { createCanvasForNode } = fabric;

export class CanvasLayer {
    protected canvas: Canvas;

    get isDirty() { return this._isDirty; }
    protected _isDirty = false; // has the canvas been modified

    constructor() {
        this.canvas = createCanvasForNode(0, 0);
    }

    get dataUrl(): string {
        this._isDirty = false;
        return this.canvas.toDataURL();
    }

    setDimensions(width: number, height: number): void {
        this.canvas.setWidth(width);
        this.canvas.setHeight(height);
        this._isDirty = true;
    }
}
