import { expect, sinon } from '../common';

import { PathDrawable, PenType } from '../../src/whiteboard/data-retriever';
import { PathLayer } from '../../src/whiteboard/path-layer';

describe('PathLayer', () => {
    let sut: PathLayer;

    beforeEach(() => {
        sut = new PathLayer();
    });

    describe('addPath()', () => {
        it('should add the path to the canvas, and set _isDirty to true', () => {
            const spy = sinon.spy(sut.canvas, 'add');

            const drawable: PathDrawable = {
                path: '',
                key: '',
                type: 'path',
                isEraser: false,
                penType: PenType.Normal,
                strokeWidth: 1,
                strokeColor: '0,0,0',
                strokeOpacity: 1,
                d3: '|A42.000,42.000|'
            };
            sut.addPath(drawable);

            expect(sut.isDirty).to.be.true;
            expect(spy).to.have.been.calledOnce;
        });
    });
});
