import { CanvasLayer } from './canvas-layer';
import { PathDrawable } from './data-retriever';
import { PathFactory } from './paths/path-factory';

export class PathLayer extends CanvasLayer {
    addPath(drawable: PathDrawable): void {
        const path = PathFactory.parsePath(drawable);
        this.canvas.add(path as any);
        this._isDirty = true;
    }
}
