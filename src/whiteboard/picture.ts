import * as Canvas from 'canvas';
import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;

import { PictureDrawable } from './data-retriever';
import { ExifOrientation, JpegDecoder, JpegMetadata } from './jpeg-decoder';

/**
 * @interface CGAffineTransform properties - see https://github.com/revdotcom/revtutorios/wiki/Pictures-Algorithm
 */
interface Transform {
    a: number;
    b: number;
    c: number;
    d: number;
    tx: number;
    ty: number;
}

/**
 * @class Class for transforming a given PictureDrawable's binary data into a fabric Image
 */
export class Picture {
    private drawable: PictureDrawable;
    private transform: Transform;

    // buffer for the src image
    private binaryData: Buffer;
    private metadata?: JpegMetadata;

    /**
     * @property Unique id
     */
    get key() { return this.drawable.key; };

    /**
     * @property Fabric staging object to be added to the whiteboard's canvas
     */
    get image() { return this._image; };
    private _image: fabric.Image;

    constructor(drawable: PictureDrawable, binaryData: Buffer) {
        this.drawable = drawable;
        this.binaryData = binaryData;

        // for now, only JPEGs need to be decoded for their metadata,
        // to adjust for their orientation
        const url = drawable.imageURL!;
        if (url.slice(url.lastIndexOf('.') + 1) === 'jpeg') {
            this.decodeImage();
        }

        const canvas = new Canvas.Image();
        canvas.src = this.binaryData;

        this._image = new fabric.Image(canvas as any, {});
        this.applyTransform(drawable.transform);
    }

    /**
     * Parses a given affine transform string, and transforms the src image appropriately
     * @param str - the string defining the new transform to apply
     */
    applyTransform(str: string): void {
        this.drawable.transform = str;
        this.transform = Picture.parseTransform(str);

        this.image.setAngle(this.rotation);
        this.image.setLeft(this.offset.x);
        this.image.setTop(this.offset.y);

        // swap the width and height depending on the orientation
        const orientationRotation = this.orientationRotation;
        if (orientationRotation === 0 || orientationRotation === 180) {
            this.image.setWidth(this.width);
            this.image.setHeight(this.height);
        } else {
            this.image.setWidth(this.height);
            this.image.setHeight(this.width);
        }
    }

    private static parseTransform(str: string): Transform {
        // exclude array bracket chars
        const transformArray = str.substring(1, str.length - 1).split(', ');

        return {
            a: parseFloat(transformArray[0]),
            b: parseFloat(transformArray[1]),
            c: parseFloat(transformArray[2]),
            d: parseFloat(transformArray[3]),
            tx: parseFloat(transformArray[4]),
            ty: parseFloat(transformArray[5])
        };
    }

    // currently only supports 90 degree rotations
    private get rotation(): number {
        const {a, b, c, d} = this.transform;

        let rotation = 0;
        if ((a === d && a !== 0) && (b === c && b === 0)) {
            rotation = (a > 0) ? 0 : 180;
        } else if ((Math.abs(b) === Math.abs(c) && b !== 0) && (a === d && a === 0)) {
            rotation = (b > 0) ? 90 : 270;
        }

        // adjust for the picture's orientation
        return (rotation + this.orientationRotation) % 360;
    }

    private get width(): number {
        return Math.abs(this.transform.a !== 0 ? this.transform.a : this.transform.b) * this.drawable.width;
    }

    private get height(): number {
        return Math.abs(this.transform.d !== 0 ? this.transform.d : this.transform.c) * this.drawable.height;
    }

    private get offset() {
        return { x: this.transform.tx, y: this.transform.ty };
    }

    private get orientationRotation(): number {
        const orientation = this.metadata ? this.metadata.orientation : ExifOrientation.NORMAL;
        switch (orientation) {
            case ExifOrientation.NORMAL:
                return 0;
            case ExifOrientation.ROTATE_90_DEGREES:
                return 90;
            case ExifOrientation.ROTATE_180_DEGREES:
                return 180;
            case ExifOrientation.ROTATE_270_DEGREES:
                return 270;
            default:
                return 0;
        }
    }

    private decodeImage(): void {
        // extract metadata from the binary data
        const jpeg = new JpegDecoder(this.binaryData);
        this.metadata = jpeg.metadata;

        // reset the orientation value to NORMAL to prevent the canvas from respecting it
        jpeg.setExifOrientation(ExifOrientation.NORMAL);
    }
}
