import { Observable } from 'rxjs/Observable';

import { TreeDataEventType } from '../blaze/tree-data-event';
import { TreeDatabase } from '../blaze/tree-database';
import { PageType } from './background-layer';

export type PageInfo = {
    paperType: PageType;
};

export type WhiteboardInfo = {
    canvasWidth: number;
    canvasHeight: number;
    pages: {[key: string]: PageInfo};
};

export type MemberInfo = {
    audioStatus: number;
};

export enum PenType {
    Normal = 0,
    Calligraphy = 1
}

export interface Drawable {
    path: string;
    key: string;
    type: string;
}

export interface PathDrawable extends Drawable {
    isEraser: boolean;
    penType: PenType;
    strokeWidth: number;
    strokeColor: string;
    strokeOpacity: number;
    d2?: {};
    d3?: string;
}

export interface PictureDrawable extends Drawable {
    transform: string;
    imageURL?: string;
    width: number;
    height: number;
}

export class DataRetriever {
    private blazeDb: TreeDatabase;

    constructor(blazeDb: TreeDatabase) {
        this.blazeDb = blazeDb;
    }

    listenForWhiteboardInfo(): Observable<WhiteboardInfo> {
        return this.blazeDb.reference('whiteboard')
            .changes(new Set([TreeDataEventType.ValueChanged]))
            .map(ev => ev.value.toJSON() as WhiteboardInfo);
    }

    listenForAudioStart(): Observable<MemberInfo> {
        return this.blazeDb.reference('session/members')
            .changes(new Set([TreeDataEventType.ChildChanged]))
            .map(ev => ev.value.toJSON() as MemberInfo)
            .filter(info => info.audioStatus === 2);
    }

    // TODO: create an observable for a specific page, instead of just the first
    listenForDrawables(): Observable<Drawable> {
        return this.blazeDb.reference('drawablesData')
            .changes(new Set([TreeDataEventType.ChildAdded, TreeDataEventType.ChildChanged]))
            .map(ev => {
                const json = ev.value.toJSON() as { [key: string]: any };
                const drawableIds = Object.keys(json);

                const key = drawableIds.pop()!;
                const drawable = json[key] as Drawable;

                drawable.path = `${ev.value.path}/${key}`;
                drawable.key = key;

                return drawable;
            });
    }

    listenForPictureUpdate(path: string): Observable<PictureDrawable> {
        return this.blazeDb.reference(path)
            .changes(new Set([TreeDataEventType.ValueChanged]))
            .map(ev => {
                const drawable: PictureDrawable = (ev.value.toJSON() as any);
                const key = ev.value.key;

                drawable.path = `${ev.value.path}/${key}`;
                drawable.key = key;

                return drawable;
            });
    }
}
