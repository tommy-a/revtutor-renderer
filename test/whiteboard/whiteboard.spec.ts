import { expect, sinon } from '../common';

import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;
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
        writeSnapshot: sinon.SinonStub,
        writeElapsedFrames: sinon.SinonStub;

    let audioStartObs: Subject<MemberInfo>,
        whiteboardInfoObs: Subject<WhiteboardInfo>,
        drawablesObs: Subject<Drawable>,
        pictureUpdatesObs: Subject<PictureDrawable>;

    let dataRetriever: DataRetriever,
        sut: Whiteboard;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();

        // stub dependencies
        sandbox.stub(picture, 'Picture').returns(MOCK_PICTURE);
        sandbox.stub(pathFactory, 'PathFactory').returns({ parsePath: MOCK_PICTURE.image });

        // stub out observables for triggering blazeDb events
        audioStartObs = new Subject<MemberInfo>();
        whiteboardInfoObs = new Subject<WhiteboardInfo>();
        drawablesObs = new Subject<Drawable>();
        pictureUpdatesObs = new Subject<PictureDrawable>();

        dataRetriever = new DataRetriever(new TreeDatabase(false));
        sinon.stub(dataRetriever, 'listenForAudioStart').returns(audioStartObs.asObservable());
        sinon.stub(dataRetriever, 'listenForWhiteboardInfo').returns(whiteboardInfoObs.asObservable());
        sinon.stub(dataRetriever, 'listenForDrawables').returns(drawablesObs.asObservable());
        sinon.stub(dataRetriever, 'listenForPictureUpdate').returns(pictureUpdatesObs.asObservable());

        sut = new Whiteboard(TEST_OUTPUT_DIR, {}, dataRetriever);

        writeSnapshot = sandbox.stub(sut, 'writeSnapshot').returns({ catch: () => null });
        writeElapsedFrames = sandbox.stub(sut, 'writeElapsedFrames').returns({ catch: () => null });
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
        it('should not write frames while the whiteboard is unchanged', async () => {
            await sut.render();
            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).not.to.have.been.called;
        });

        it('should overwrite the initial dimensions frame when adding the first picture, before the audio starts', async () => {
            whiteboardInfoObs.next({ canvasWidth: 10, canvasHeight: 10, pages: { key: { paperType: 2 } } });
            drawablesObs.next({ type: 'picture' } as Drawable);

            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(0);
        });

        it('should not write a frame when the audio starts', async () => {
            audioStartObs.next({ audioStatus: 2 });

            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).not.to.have.been.called;
        });

        it('should write a single frame for a path update', async () => {
            audioStartObs.next({ audioStatus: 2 });
            drawablesObs.next({ type: 'path', d2: '' } as any);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });

        it('should write elapsed frames', async () => {
            audioStartObs.next({ audioStatus: 2 });
            drawablesObs.next({ type: 'path', d2: '' } as any);

            sut.addDelta(3 * (1 / sut.fps) * 1000); // add enough for three total frames
            await sut.render();

            expect(writeElapsedFrames).to.have.been.calledWithExactly(2);
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });

        it('should write a single frame for a transformed picture', async () => {
            // add the initial picture
            audioStartObs.next({ audioStatus: 2 });
            drawablesObs.next({ type: 'picture' } as Drawable);

            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(0);
            writeElapsedFrames.resetHistory();
            writeSnapshot.resetHistory();

            // transform the picture
            pictureUpdatesObs.next({ key: MOCK_PICTURE.key } as PictureDrawable);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });
    });
});
