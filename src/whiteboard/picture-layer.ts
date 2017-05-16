import { CanvasLayer } from './canvas-layer';
import { PictureDrawable } from './data-retriever';
import { Picture } from './picture';

/**
 * @class Class for transforming and drawing pictures to an instance of a fabric canvas
 */
export class PictureLayer extends CanvasLayer {
    /**
     * @property Array of Pictures for caching binary image srcs and applying new transformations to
     */
    private pictures = new Map<string, Picture>();

    /**
     * Checks whether or not a picture has already been added
     * @param key - the key of the picture to check for
     * @returns true if the picture has been added, otherwise false
     */
    hasPicture(key: string): boolean {
        return (this.pictures.get(key) !== undefined);
    }

    /**
     * Adds a picture drawable to the canvas to be drawn, as well as marks _isDirty to true
     * @param drawable - a Picture object containing the fabric image to be drawn
     */
    addPicture(p: Picture): void {
        this.pictures.set(p.key, p);
        this.canvas.add(p.image);
        this._isDirty = true;
    }

    /**
     * Applies a new transform to a given picture, resulting in the redrawing of the canvas
     * @param key - a PictureDrawable key representing the Picture to apply the transform to
     * @param transform - the new transform string to apply
     */
    transformPicture(d: PictureDrawable): void {
        const picture = this.pictures.get(d.key);
        picture!.applyTransform(d.transform);
        this.redraw();
    }

    /**
     * Removes a previously drawn picture from, as well as marks _isDirty to true
     * @param key - the key of the picture object to remove
     */
    removePicture(key: string): void {
        this.pictures.delete(key);
        this.redraw();
    }

    /**
     * Called whenever a picture is updated or removed; redraws all image's to the canvas in
     * the order in which they were originally added
     */
    private redraw(): void {
        this.canvas.clear();
        this.pictures.forEach(p => this.canvas.add(p.image));
        this._isDirty = true;
    }
}
