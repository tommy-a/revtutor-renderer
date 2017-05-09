import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;

import { CanvasLayer } from './canvas-layer';
import { PathDrawable } from './data-retriever';
import { PathFactory } from './paths/path-factory';

/**
 * @class Class for drawing paths to an instance of a fabric canvas
 */
export class PathLayer extends CanvasLayer {
    private paths = new Map<string, fabric.Object>();

    /**
     * Incrementally draws a path onto a staging canvas, as well as marks _isDirty to true
     * @param drawable - a PathDrawable object with the properties for the path to be drawn
     */
    drawPath(drawable: PathDrawable): void {
        const path = PathFactory.parsePath(drawable) as any;
        this.paths.set(drawable.key, path);
        this.redraw();
    }

    private redraw(): void {
        this.canvas.clear();
        this.paths.forEach(p => this.canvas.add(p));
        this._isDirty = true;
    }
}
