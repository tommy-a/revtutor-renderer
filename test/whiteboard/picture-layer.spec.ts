import { expect, sinon } from '../common';

import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
const { createCanvasForNode } = fabric;

import { TreeDataEventType } from '../../src/blaze/tree-data-event';
import { PictureDrawable } from '../../src/whiteboard/data-retriever';
import { Picture } from '../../src/whiteboard/picture';
import { PictureLayer } from '../../src/whiteboard/picture-layer';

describe('PictureLayer', () => {
    let sut: PictureLayer;

    beforeEach(() => {
        sut = new PictureLayer(100, 100);
    });

    describe('addPicture()', () => {
        it('should add a picture to the canvas, and set _isDirty to true', async () => {
            const spy = sinon.spy(sut.canvas, 'add');

            const picture = await createTestPicture(10);
            sut.addPicture(picture);

            expect(sut.isDirty).to.be.true;
            expect(sut.canvas.getObjects()[0]).to.equal(picture.image);
            expect(spy).to.have.been.calledOnce.calledWithExactly(picture.image);
        });
    });

    describe('transformPicture()', () => {
        it('should apply the transform to the picture given by key, and set _isDirty to true', async () => {
            const picture = await createTestPicture(10);
            sut.addPicture(picture);

            const spy = sinon.spy(picture, 'applyTransform');
            const transform = '[0.5, 0, 0, 0.5, 0, 0]';
            sut.transformPicture({key: picture.key, transform} as any);

            expect(spy).to.have.been.calledOnce.calledWithExactly(transform);
        });

        it('should redraw all pictures to the canvas, and set _isDirty to true', async () => {
            const spy = sinon.spy(sut.canvas, 'add');

            // add two test pictures
            const pictureA = await createTestPicture(20, 'keyA');
            const pictureB = await createTestPicture(10, 'keyB');
            sut.addPicture(pictureA);
            sut.addPicture(pictureB);

            expect(spy).to.have.been.calledTwice;
            spy.reset();

            // transform the second picture
            const transform = '[0.5, 0, 0, 0.5, 0, 0]';
            sut.transformPicture({key: pictureB.key, transform} as any);

            expect(sut.isDirty).to.be.true;
            expect(spy).to.have.been.calledTwice;
            expect(spy.firstCall).to.have.been.calledWithExactly(pictureA.image);
            expect(spy.secondCall).to.have.been.calledWithExactly(pictureB.image);
        });
    });

    describe('removePicture()', () => {
        it('should remove a previously added picture from the canvas, and set _isDirty to true', async () => {
            const spy = sinon.spy(sut.canvas, 'add');

            // add the initial picture
            const picture = await createTestPicture(10, 'key');
            sut.addPicture(picture);

            spy.reset();

            // remove the picture
            sut.removePicture('key');

            expect(sut.isDirty).to.be.true;
            expect(spy).not.to.have.been.calledTwice;
        });
    });
});

/**
 * Creates a square Picture for testing
 * @param length - side length of the square to draw
 * @returns a Promise for the resulting Picture object
 */
async function createTestPicture(length: number, key = ''): Promise<Picture> {
    return new Promise<Picture>(async resolve => {
        const drawable: PictureDrawable = {
            key,
            type: 'picture',
            imageURL: '',
            transform: '[1, 0, 0, 1, 0, 0]',
            width: length,
            height: length
        };

        const squareUrl = drawSquare(length);
        fabric.Image.fromURL(squareUrl, (image) => {
            const picture = new Picture(new Buffer(0), image);
            picture.setDrawable(drawable);
            resolve(picture);
        });
    });
}

/**
 * Creates a square image, and returns the data URI for it
 * @param length - side length of the square to draw
 * @returns the resulting data URI
 */
function drawSquare(length: number): string {
    const canvas = createCanvasForNode(length, length);

    const shape = new fabric.Rect({ width: length, height: length});
    canvas.add(shape);

    return canvas.toDataURL();
}
