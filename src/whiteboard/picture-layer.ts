import { CanvasLayer } from './canvas-layer';
import { Picture } from './picture';

/**
 * @class Class for transforming and drawing pictures to an instance of a fabric canvas
 */
export class PictureLayer extends CanvasLayer {
    /**
     * @property Array of Pictures for caching binary image srcs and applying new transformations to
     */
    private pictures: Picture[] = [];

    constructor() {
        super();

        // TODO: remove this line (and the one in redraw()) after creating a BackgroundLayer class
        this.canvas.setBackgroundColor('rgba(255, 255, 255, 1.0)', () => this.canvas.renderAll());
    }

    /**
     * Adds a picture drawable to the canvas to be drawn, as well as marks _isDirty to true
     * @param drawable - a Picture object containing the fabric image to be drawn
     */
    addPicture(p: Picture): void {
        this.pictures.push(p);
        this.canvas.add(p.image);
        this._isDirty = true;
    }

    /**
     * Applies a new transform to a given picture, resulting in the redrawing of the canvas
     * @param key - a PictureDrawable key representing the Picture to apply the transform to
     * @param transform - the new transform string to apply
     */
    transformPicture(key: string, transform: string): void {
        const picture = this.pictures.find(p => p.key === key);
        if (picture) {
            picture.applyTransform(transform);
            this.redraw();
        }
    }

    /**
     * Called whenever a picture's transform updates; redraws all image's to the canvas in
     * the order in which they were originally added
     */
    private redraw(): void {
        this.canvas.clear();
        this.canvas.setBackgroundColor('rgba(255, 255, 255, 1.0)', () => this.canvas.renderAll());

        this.pictures.forEach(p => this.canvas.add(p.image));
        this._isDirty = true;
    }
}
