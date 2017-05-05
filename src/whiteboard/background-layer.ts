import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;

import { CanvasLayer } from './canvas-layer';

export enum PageType {
    Graph = 1,
    Plain = 2,
    LinedPortrait = 3,
    LinedLandscape = 4
}

/**
 * @class Class for drawing a specific PaperType for a given page
 */
export class BackgroundLayer extends CanvasLayer {
    static lineColor = 'rgba(0,0,0,0.3)';
    static lineWidth = 1;

    setPageType(type: PageType): void {
        this.canvas.clear();
        this.canvas.setBackgroundColor('rgba(255, 255, 255, 1.0)', () => this.canvas.renderAll());

        switch (type) {
            case PageType.Graph:
                return this.renderGraph();
            case PageType.LinedPortrait:
                return this.renderLinedPortrait();
            case PageType.LinedLandscape:
                return this.renderLinedLandscape();
            default:
                return;
        }
    }

    private renderGraph() {
        const kGraphHSpacing = 32;
        const kGraphVSpacing = 32;
        const kGraphTopMargin = 0.5;
        const kGraphLeftMargin = 0.5;

        this.drawLines(true, kGraphTopMargin, 0.5, this.width - 0.5, kGraphHSpacing, this.height);
        this.drawLines(false, kGraphLeftMargin, 0.5, this.height - 0.5, kGraphVSpacing, this.width);
    }

    private renderLinedPortrait() {
        const kPortraitLinedSpacing = 40;
        const kPortraitLinedTopMargin = 40;

        this.drawLines(true, kPortraitLinedTopMargin, 0.5, this.width - 0.5, kPortraitLinedSpacing, this.height);
    }

    private renderLinedLandscape() {
        const kLandscapeLinedSpacing = 40;
        const kLandscapeLinedTopMargin = 40;

        this.drawLines(false, kLandscapeLinedTopMargin, 0.5, this.height - 0.5, kLandscapeLinedSpacing, this.width);
    }

    private drawLines(
        isHorizontal: boolean,
        startMargin: number,
        leadingMargin: number,
        trailingMargin: number,
        spacing: number,
        stopMargin: number
    ) {
        for (let i = startMargin; i < stopMargin; i += spacing) {
            const [x1, y1] = isHorizontal ? [leadingMargin, i] : [i, leadingMargin];
            const [x2, y2] = isHorizontal ? [trailingMargin, i] : [i, trailingMargin];

            this.canvas.add(new fabric.Line([x1, y1, x2, y2], {
                stroke: BackgroundLayer.lineColor,
                strokeWidth: BackgroundLayer.lineWidth
            }));
        }
    }
}
