import { expect } from '../common';

import * as Canvas from 'canvas';
import * as dataUriToBuffer from 'data-uri-to-buffer';
import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;

import { PictureDrawable } from '../../src/whiteboard/data-retriever';
import { Picture } from '../../src/whiteboard/picture';

describe('Picture', () => {
    const TEST_IMAGE_WIDTH = 8,
          TEST_IMAGE_HEIGHT = 10;

    const TEST_IMAGE_SRC = {
        NORMAL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QCARXhpZgAATU0AKgAAAAgABAESAAMAAAABAAEAAAEaAAUAAAABAAAAPgEbAAUAAAABAAAARodpAAQAAAABAAAATgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAAigAwAEAAAAAQAAAAoAAAAA/+0AOFBob3Rvc2hvcCAzLjAAOEJJTQQEAAAAAAAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/AABEIAAoACAMBEgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAICAgICAgMCAgMEAwMDBAUEBAQEBQcFBQUFBQcIBwcHBwcHCAgICAgICAgKCgoKCgoLCwsLCw0NDQ0NDQ0NDQ3/2wBDAQICAgMDAwYDAwYNCQcJDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ3/3QAEAAH/2gAMAwEAAhEDEQA/AONj8GaTD8HfD/xD1LXri11O5H2rUree7tfsq2cr+Wsa2wj+1xzowwSzkAqzMNpAGx498PaBFqNqsemWaAM7ALBGAC3yk/d6leD6jjpXmqnfFSg3obyqU1gIyUFzPqf/2Q==',
        ROTATE_180_DEGREES: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QCARXhpZgAATU0AKgAAAAgABAESAAMAAAABAAMAAAEaAAUAAAABAAAAPgEbAAUAAAABAAAARodpAAQAAAABAAAATgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAAigAwAEAAAAAQAAAAoAAAAA/+0ALFBob3Rvc2hvcCAzLjAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/AABEIAAoACAMBEgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAICAgICAgMCAgMEAwMDBAUEBAQEBQcFBQUFBQcIBwcHBwcHCAgICAgICAgKCgoKCgoLCwsLCw0NDQ0NDQ0NDQ3/2wBDAQICAgMDAwYDAwYNCQcJDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ3/3QAEAAH/2gAMAwEAAhEDEQA/AONj8GaTD8HfD/xD1LXri11O5H2rUree7tfsq2cr+Wsa2wj+1xzowwSzkAqzMNpAGx498PaBFqNqsemWaAM7ALBGAC3yk/d6leD6jjpXmqnfFSg3obyqU1gIyUFzPqf/2Q==',
        ROTATE_90_DEGREES: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QCARXhpZgAATU0AKgAAAAgABAESAAMAAAABAAYAAAEaAAUAAAABAAAAPgEbAAUAAAABAAAARodpAAQAAAABAAAATgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAAigAwAEAAAAAQAAAAoAAAAA/+0ALFBob3Rvc2hvcCAzLjAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/AABEIAAoACAMBEgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAICAgICAgMCAgMEAwMDBAUEBAQEBQcFBQUFBQcIBwcHBwcHCAgICAgICAgKCgoKCgoLCwsLCw0NDQ0NDQ0NDQ3/2wBDAQICAgMDAwYDAwYNCQcJDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ3/3QAEAAH/2gAMAwEAAhEDEQA/AONj8GaTD8HfD/xD1LXri11O5H2rUree7tfsq2cr+Wsa2wj+1xzowwSzkAqzMNpAGx498PaBFqNqsemWaAM7ALBGAC3yk/d6leD6jjpXmqnfFSg3obyqU1gIyUFzPqf/2Q==',
        ROTATE_270_DEGREES: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QCARXhpZgAATU0AKgAAAAgABAESAAMAAAABAAgAAAEaAAUAAAABAAAAPgEbAAUAAAABAAAARodpAAQAAAABAAAATgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAAigAwAEAAAAAQAAAAoAAAAA/+0ALFBob3Rvc2hvcCAzLjAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/AABEIAAoACAMBEgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAICAgICAgMCAgMEAwMDBAUEBAQEBQcFBQUFBQcIBwcHBwcHCAgICAgICAgKCgoKCgoLCwsLCw0NDQ0NDQ0NDQ3/2wBDAQICAgMDAwYDAwYNCQcJDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ3/3QAEAAH/2gAMAwEAAhEDEQA/AONj8GaTD8HfD/xD1LXri11O5H2rUree7tfsq2cr+Wsa2wj+1xzowwSzkAqzMNpAGx498PaBFqNqsemWaAM7ALBGAC3yk/d6leD6jjpXmqnfFSg3obyqU1gIyUFzPqf/2Q=='
    };

    function createTransformStr(a: number, b: number, c: number, d: number, tx: number, ty: number): string {
        return `[${a}, ${b}, ${c}, ${d}, ${tx}, ${ty}]`;
    }

    const TR_SCALE = 0.5,
          TR_X_OFFSET = 5,
          TR_Y_OFFSET = 5;

    const TR_0_DEGREE_ROTATION = createTransformStr(TR_SCALE, 0, 0, TR_SCALE, TR_X_OFFSET, TR_Y_OFFSET),
          TR_90_DEGREE_ROTATION = createTransformStr(0, TR_SCALE, -TR_SCALE, 0, TR_X_OFFSET, TR_Y_OFFSET),
          TR_180_DEGREE_ROTATION = createTransformStr(-TR_SCALE, 0, 0, -TR_SCALE, TR_X_OFFSET, TR_Y_OFFSET),
          TR_270_DEGREE_ROTATION = createTransformStr(0, -TR_SCALE, TR_SCALE, 0, TR_X_OFFSET, TR_Y_OFFSET);

    let drawable: PictureDrawable,
        sut: Picture;

    beforeEach(() => {
        drawable = {
            type: 'picture',
            key: '-KTKhY0ORZxKr7a8Esl7',
            imageURL: 'test.jpeg',
            width: TEST_IMAGE_WIDTH,
            height: TEST_IMAGE_HEIGHT,
            transform: TR_0_DEGREE_ROTATION
        };
    });

    [[TR_0_DEGREE_ROTATION, 0], [TR_90_DEGREE_ROTATION, 90],
            [TR_180_DEGREE_ROTATION, 180], [TR_270_DEGREE_ROTATION, 270]].forEach((a) => {
        [[TEST_IMAGE_SRC.NORMAL, 0], [TEST_IMAGE_SRC.ROTATE_90_DEGREES, 90],
                [TEST_IMAGE_SRC.ROTATE_180_DEGREES, 180], [TEST_IMAGE_SRC.ROTATE_270_DEGREES, 270]].forEach((b) => {
            const transform = a[0] as string;
            const rotation = a[1] as number;
            const src = b[0] as string;
            const orientationRotation = b[1] as number;

            it(`should render ${rotation} degree rotation for ${orientationRotation} degree orientation`, async () => {
                const buffer = dataUriToBuffer(src);
                const image = await createImage(buffer);

                sut = new Picture(buffer, image);

                drawable.transform = transform;
                sut.setDrawable(drawable);

                let width: number, height: number;
                if (orientationRotation === 0 || orientationRotation === 180) {
                    width = TEST_IMAGE_WIDTH;
                    height = TEST_IMAGE_HEIGHT;
                } else {
                    width = TEST_IMAGE_HEIGHT;
                    height = TEST_IMAGE_WIDTH;
                }

                expect(image.getWidth()).to.equal(TR_SCALE * width);
                expect(image.getHeight()).to.equal(TR_SCALE * height);
                expect(image.getLeft()).to.equal(TR_X_OFFSET);
                expect(image.getTop()).to.equal(TR_Y_OFFSET);
                expect(image.getAngle()).to.equal((rotation + orientationRotation) % 360);
            });
        });
    });

    describe('applyTransform', () => {
        it('should render a new transformation', async () => {
            const buffer = dataUriToBuffer(TEST_IMAGE_SRC.NORMAL);
            const image = await createImage(buffer);

            sut = new Picture(buffer, image);
            sut.setDrawable(drawable);

            expect(image.getAngle()).to.equal(0);

            sut.applyTransform(TR_90_DEGREE_ROTATION);

            expect(image.getWidth()).to.equal(TR_SCALE * TEST_IMAGE_WIDTH);
            expect(image.getHeight()).to.equal(TR_SCALE * TEST_IMAGE_HEIGHT);
            expect(image.getLeft()).to.equal(TR_X_OFFSET);
            expect(image.getTop()).to.equal(TR_Y_OFFSET);
            expect(image.getAngle()).to.equal(90);
        });
    });
});

/**
 * Creates a fabric image from a binary data buffer
 * @param buffer - the source binary data
 * @returns a Promise for the resulting image
 */
async function createImage(buffer: Buffer): Promise<fabric.Image> {
    return new Promise<fabric.Image>((resolve) => {
        const canvas = new Canvas.Image();

        canvas.onload = () => {
            resolve(new fabric.Image(canvas as any, {}));
        };

        canvas.src = buffer;
    });
}
