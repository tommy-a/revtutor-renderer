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
        url: 'www.hi.com',
        image: new fabric.Rect({ width: 10, height: 10}),
        applyTransform: () => null,
        setDrawable: () => null
    };

    let sandbox: sinon.SinonSandbox,
        writeSnapshot: sinon.SinonStub,
        writeElapsedFrames: sinon.SinonStub;

    let audioStartObs: Subject<MemberInfo>,
        whiteboardInfoObs: Subject<WhiteboardInfo>,
        pagesObs: Subject<string>,
        addedDrawablesObs: Subject<Drawable>,
        changedDrawablesObs: Subject<Drawable>,
        removedDrawablesObs: Subject<string>;

    let dataRetriever: DataRetriever,
        sut: Whiteboard;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();

        // stub dependencies
        sandbox.stub(pathFactory, 'PathFactory').returns({ parsePath: MOCK_PICTURE.image });

        // stub out observables for triggering blazeDb events
        audioStartObs = new Subject<MemberInfo>();
        whiteboardInfoObs = new Subject<WhiteboardInfo>();
        pagesObs = new Subject<string>();
        addedDrawablesObs = new Subject<Drawable>();
        changedDrawablesObs = new Subject<Drawable>();
        removedDrawablesObs = new Subject<string>();

        dataRetriever = new DataRetriever(new TreeDatabase(false));
        sinon.stub(dataRetriever, 'listenForAudioStart').returns(audioStartObs.asObservable());
        sinon.stub(dataRetriever, 'listenForWhiteboardInfo').returns(whiteboardInfoObs.asObservable());
        sinon.stub(dataRetriever, 'listenForPages').returns(pagesObs.asObservable());
        sinon.stub(dataRetriever, 'listenForAddedDrawables').returns(addedDrawablesObs.asObservable());
        sinon.stub(dataRetriever, 'listenForChangedDrawables').returns(changedDrawablesObs.asObservable());
        sinon.stub(dataRetriever, 'listenForRemovedDrawables').returns(removedDrawablesObs.asObservable());

        const images = new Map<string, picture.Picture>();
        images.set(MOCK_PICTURE.url, MOCK_PICTURE as any);

        sut = new Whiteboard(TEST_OUTPUT_DIR, images, dataRetriever);

        writeSnapshot = sandbox.stub(sut, 'writeSnapshot').returns({ catch: () => null });
        writeElapsedFrames = sandbox.stub(sut, 'writeElapsedFrames').returns({ catch: () => null });

        pagesObs.next('pageKey');
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
            addedDrawablesObs.next({ type: 'picture' } as Drawable);

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
            changedDrawablesObs.next({ type: 'path', d2: {} } as any);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });

        it('should write elapsed frames', async () => {
            audioStartObs.next({ audioStatus: 2 });
            changedDrawablesObs.next({ type: 'path', d2: {} } as any);

            sut.addDelta(3 * (1 / sut.fps) * 1000); // add enough for three total frames
            await sut.render();

            expect(writeElapsedFrames).to.have.been.calledWithExactly(2);
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });

        it('should write a single frame for a transformed picture', async () => {
            // add the initial picture
            audioStartObs.next({ audioStatus: 2 });
            addedDrawablesObs.next({ type: 'picture', imageURL: MOCK_PICTURE.url } as any);

            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(0);
            writeElapsedFrames.resetHistory();
            writeSnapshot.resetHistory();

            // transform the picture
            changedDrawablesObs.next({ key: MOCK_PICTURE.key, imageURL: MOCK_PICTURE.url } as PictureDrawable);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });

        it('should write a single frame for a removed picture', async () => {
            // add the initial picture
            audioStartObs.next({ audioStatus: 2 });
            addedDrawablesObs.next({ type: 'picture', imageURL: MOCK_PICTURE.url } as any);

            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(0);
            writeElapsedFrames.resetHistory();
            writeSnapshot.resetHistory();

            // remove the picture
            removedDrawablesObs.next(MOCK_PICTURE.key);

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });

        it('should write a single frame for a removed path', async () => {
            // add the initial path
            audioStartObs.next({ audioStatus: 2 });
            addedDrawablesObs.next({ type: 'path', key: 'key', d2: {} } as any);

            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(0);
            writeElapsedFrames.resetHistory();
            writeSnapshot.resetHistory();

            // remove the path
            removedDrawablesObs.next('key');

            sut.addDelta((1 / sut.fps) * 1000); // add enough for one frame
            await sut.render();

            expect(writeElapsedFrames).not.to.have.been.called;
            expect(writeSnapshot).to.have.been.calledOnce.calledWithExactly(1);
        });
    });
});
