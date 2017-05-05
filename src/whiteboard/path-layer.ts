import { CanvasLayer } from './canvas-layer';
import { PathDrawable } from './data-retriever';
import { PathFactory } from './paths/path-factory';

/**
 * @class Class for drawing paths to an instance of a fabric canvas
 */
export class PathLayer extends CanvasLayer {
    /**
     * Adds a path drawable to the canvas to be drawn, as well as marks _isDirty to true
     * @param drawable - a PathDrawable object with the properties for the path to be drawn
     */
    addPath(drawable: PathDrawable): void {
        const path = PathFactory.parsePath(drawable);
        this.canvas.add(path as any);
        this._isDirty = true;
    }
}
