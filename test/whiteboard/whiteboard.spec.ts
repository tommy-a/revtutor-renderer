import { expect, sinon } from '../common';

import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
import * as fs from 'fs';
import { Subject } from 'rxjs/Subject';

import { TreeDatabase } from '../../src/blaze/tree-database';
import { DataRetriever, Drawable, MemberInfo, PictureDrawable, WhiteboardInfo } from '../../src/whiteboard/data-retriever';
import * as pathFactory from '../../src/whiteboard/paths/path-factory';
import * as picture from '../../src/whiteboard/picture';
import { Whiteboard } from '../../src/whiteboard/whiteboard';

describe('Whiteboard', () => {
    const TEST_OUTPUT_DIR = './snapshots';
    const MOCK_PICTURE = {
        key: '-Kj0BbjRzTOss_JR4rth',
        image: new fabric.Rect({ width: 10, height: 10}),
        applyTransform: () => null
    };

    let sandbox: sinon.SinonSandbox,
        createWriteStream: sinon.SinonStub,
        createReadStream: sinon.SinonStub,
        writeElapsedFrames: sinon.SinonSpy;

    let audioStartObs: Subject<MemberInfo>,
        dimensionsObs: Subject<WhiteboardInfo>,
        drawablesObs: Subject<Drawable>,
        pictureUpdatesObs: Subject<PictureDrawable>;

    let dataRetriever: DataRetriever,
        sut: Whiteboard;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();

        // stub dependencies
        createReadStream = sandbox.stub(fs, 'createReadStream').returns({ on: () => null, pipe: () => null });
        createWriteStream = sandbox.stub(fs, 'createWriteStream').returns({ on: () => null });
        sandbox.stub(picture, 'Picture').returns(MOCK_PICTURE);
        sandbox.stub(pathFactory, 'PathFactory').returns({ parsePath: MOCK_PICTURE.image });

        // stub out observables for triggering blazeDb events
        audioStartObs = new Subject<MemberInfo>();
        dimensionsObs = new Subject<WhiteboardInfo>();
        drawablesObs = new Subject<Drawable>();
        pictureUpdatesObs = new Subject<PictureDrawable>();

        dataRetriever = new DataRetriever(new TreeDatabase(false));
        sinon.stub(dataRetriever, 'listenForAudioStart').returns(audioStartObs.asObservable());
        sinon.stub(dataRetriever, 'listenForDimensions').returns(dimensionsObs.asObservable());
        sinon.stub(dataRetriever, 'listenForDrawables').returns(drawablesObs.asObservable());
        sinon.stub(dataRetriever, 'listenForPictureUpdate').returns(pictureUpdatesObs.asObservable());

        sut = new Whiteboard(TEST_OUTPUT_DIR, {}, dataRetriever);

        writeElapsedFrames = sandbox.spy(sut, 'writeElapsedFrames');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('addDelta()', () => {
        it('should not move the clock forward when isStarted is false', () => {
            sut.addDelta(1);
            expect((sut as any).clock).to.equal(0);
        });

        it('should move the clock forward when isStarted is true', () => {
            audioStartObs.next({ audioStatus: 2 });
            sut.addDelta(1);
            expect((sut as any).clock).to.equal(1);
        });
    });

    describe('render()', () => {
        it('should not write frames while the whiteboard is unchanged', () => {
            sut.render();
            expect(createWriteStream).not.to.have.been.called;
        });

        it('should overwrite the initial dimensions frame when adding the first picture, before the audio starts', () => {
            dimensionsObs.next({ canvasWidth: 10, canvasHeight: 10 });
            drawablesObs.next({ type: 'picture' } as Drawable);

            sut.render();

            expect(createWriteStream).to.have.been.calledOnce.calledWithExactly(`${TEST_OUTPUT_DIR}/0.png`);
        });

        it('should not write a frame when the audio starts', () => {
            audioStartObs.next({ audioStatus: 2 });
            sut.render();
            expect(createWriteStream).not.to.have.been.called;
        });

        it('should write a single frame for a new path', () => {
            audioStartObs.next({ audioStatus: 2 });
            drawablesObs.next({ type: 'path', d3: '' } as any);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            sut.render();

            expect(createWriteStream).to.have.been.calledOnce.calledWithExactly(`${TEST_OUTPUT_DIR}/1.png`);
        });

        it('should write elapsed frames', () => {
            audioStartObs.next({ audioStatus: 2 });
            drawablesObs.next({ type: 'path', d3: '' } as any);

            sut.addDelta(3 * (1 / sut.fps) * 1000); // add enough for three total frames
            sut.render();

            expect(writeElapsedFrames).to.have.been.calledWithExactly(2);
        });

        it('should write a single frame for a transformed picture', () => {
            // add the initial picture
            audioStartObs.next({ audioStatus: 2 });
            drawablesObs.next({ type: 'picture' } as Drawable);

            sut.render();

            expect(createWriteStream).to.have.been.calledOnce.calledWithExactly(`${TEST_OUTPUT_DIR}/0.png`);
            createWriteStream.resetHistory();

            // transform the picture
            pictureUpdatesObs.next({ key: MOCK_PICTURE.key } as PictureDrawable);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            sut.render();

            expect(createWriteStream).to.have.been.calledOnce.calledWithExactly(`${TEST_OUTPUT_DIR}/1.png`);
        });
    });
});
