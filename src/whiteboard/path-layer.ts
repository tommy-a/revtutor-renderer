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
    drawPath(d: PathDrawable): void {
        const path = PathFactory.parsePath(d) as any;
        this.paths.set(d.key, path);
        this.redraw();
    }

    /**
     * Removes a previously drawn path, as well as marks _isDirty to true
     * @param key - the key of the path object to remove
     */
    removePath(key: string): void {
        this.paths.delete(key);
        this.redraw();
    }

    private redraw(): void {
        this.canvas.clear();
        this.paths.forEach(p => this.canvas.add(p));
        this._isDirty = true;
    }
}
