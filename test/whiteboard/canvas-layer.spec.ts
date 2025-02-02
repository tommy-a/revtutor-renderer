import { expect } from '../common';

import { CanvasLayer } from '../../src/whiteboard/canvas-layer';

describe('CanvasLayer', () => {
    let sut: CanvasLayer;

    beforeEach(() => {
        sut = new CanvasLayer(100, 100);
    });

    it('should set _isDirty to false', () => {
        expect(sut.isDirty).to.be.false;
    });

    describe('get dataUrl()', () => {
        it('should return a valid url, set _isDirty to false', () => {
            (sut as any)._isDirty = true;

            const url = sut.dataUrl;

            expect(sut.isDirty).to.be.false;
            expect(url.indexOf('data:image/png;base64')).to.equal(0);
        });
    });
});
