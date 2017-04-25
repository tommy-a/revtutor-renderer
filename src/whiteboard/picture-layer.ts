import { CanvasLayer } from './canvas-layer';
import { Picture } from './picture';

export class PictureLayer extends CanvasLayer {
    private pictures: Picture[] = []; // array of Pictures for caching binary image srcs and applying new transformations

    constructor() {
        super();
        this.canvas.setBackgroundColor('rgba(255, 255, 255, 1.0)', () => this.canvas.renderAll());
    }

    addPicture(p: Picture): void {
        this.pictures.push(p);
        this.canvas.add(p.image);
        this._isDirty = true;
    }

    transformPicture(key: string, transform: string): void {
        const picture = this.pictures.find(p => p.key === key);
        if (picture) {
            picture.applyTransform(transform);
            this.redraw();
        }
    }

    // called whenever a picture's transform updates; redraws all image's to the canvas in
    // the order in which they were originally loaded/added
    private redraw(): void {
        this.canvas.clear();
        this.canvas.setBackgroundColor('rgba(255, 255, 255, 1.0)', () => this.canvas.renderAll());

        this.pictures.forEach(p => this.canvas.add(p.image));
        this._isDirty = true;
    }
}
