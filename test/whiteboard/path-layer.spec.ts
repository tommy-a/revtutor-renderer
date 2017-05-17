import { expect, sinon } from '../common';

import { PathDrawable, PenType } from '../../src/whiteboard/data-retriever';
import { PathLayer } from '../../src/whiteboard/path-layer';

describe('PathLayer', () => {
    let path: PathDrawable,
        sut: PathLayer;

    beforeEach(() => {
        path = {
            key: 'path',
            type: 'path',
            isEraser: false,
            penType: PenType.Normal,
            strokeWidth: 1,
            strokeColor: '0,0,0',
            strokeOpacity: 1,
            d2: { 1: '|M42.000,42.000|' }
        };

        sut = new PathLayer(100, 100);
    });

    describe('drawPath()', () => {
        it('should draw a partial path to the canvas, and set _isDirty to true', () => {
            const spy = sinon.spy(sut.canvas, 'add');

            sut.drawPath(path);

            expect(sut.isDirty).to.be.true;
            expect(spy).to.have.been.calledOnce;
        });

        it('should draw a new partial path on top of the previous one, and set _isDirty to true', () => {
            const spy = sinon.spy(sut.canvas, 'add');

            // draw the first partial path
            sut.drawPath(path);

            spy.reset();

            // draw the second partial path
            path.key = 'pathB';
            path.d2 = { 1: '|M7.000,7.000|' };
            sut.drawPath(path);

            expect(sut.isDirty).to.be.true;
            expect(spy).to.have.been.calledTwice;
            expect(spy.firstCall.args[0].path[0]).to.deep.equal([ 'M', 42, 42 ]);
            expect(spy.secondCall.args[0].path[0]).to.deep.equal([ 'M', 7, 7 ]);
        });
    });

    describe('removePath()', () => {
        it('should remove a previously drawn path from the canvas, and set _isDirty to true', () => {
            const spy = sinon.spy(sut.canvas, 'add');

            // draw the first path
            sut.drawPath(path);

            spy.reset();

            // remove the path
            sut.removePath(path.key);

            expect(sut.isDirty).to.be.true;
            expect(spy).not.to.have.been.called;
        });
    });
});
