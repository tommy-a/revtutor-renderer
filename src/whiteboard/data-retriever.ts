import { Observable } from 'rxjs/Observable';

import { TreeDataEvent, TreeDataEventType } from '../blaze/tree-data-event';
import { TreeDatabase } from '../blaze/tree-database';
import { PageType } from './background-layer';

export type PageInfo = {
    key: string;
    paperType: PageType;
};

export type WhiteboardInfo = {
    canvasWidth: number;
    canvasHeight: number;
    pages: {[key: string]: PageInfo};
};

export enum SessionMemberRole {
    Student = 1,
    Tutor = 2
}

export type MemberInfo = {
    audioStatus: number;
    role: SessionMemberRole;
    currentPageFirebase?: string;
};

export enum PenType {
    Normal = 0,
    Calligraphy = 1
}

export interface Drawable {
    key: string;
    type?: string; // not present when removing a drawable
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

    listenForPageUpdates(): Observable<PageInfo> {
        return this.blazeDb.reference('whiteboard/pages')
            .changes(new Set([TreeDataEventType.ChildAdded, TreeDataEventType.ChildChanged]))
            .map(ev => {
                const pageInfo = (ev.value.toJSON() as any) as PageInfo;
                pageInfo.key = ev.value.key;
                return pageInfo;
            });
    }

    listenForMemberInfoUpdates(): Observable<MemberInfo> {
        return this.blazeDb.reference('session/members')
            .changes(new Set([TreeDataEventType.ChildChanged]))
            .map(ev => ev.value.toJSON() as MemberInfo);
    }

    listenForAddedDrawables(pageKey: string): Observable<Drawable> {
        return this.blazeDb.reference(`drawablesData/${pageKey}`)
            .changes(new Set([TreeDataEventType.ChildAdded]))
            .filter((ev) => !ev.value.value) // make sure it's an object (i.e. not 'PLACE_HOLDER')
            .map(ev => this.getDrawable(ev));
    }

    listenForChangedDrawables(pageKey: string): Observable<Drawable> {
        return this.blazeDb.reference(`drawablesData/${pageKey}`)
            .changes(new Set([TreeDataEventType.ChildChanged]))
            .map(ev => this.getDrawable(ev));
    }

    listenForRemovedDrawables(pageKey: string): Observable<string> {
        return this.blazeDb.reference(`drawablesData/${pageKey}`)
            .changes(new Set([TreeDataEventType.ChildRemoved]))
            .map(ev => ev.value.key);
    }

    private getDrawable(ev: TreeDataEvent): Drawable {
        const drawable = (ev.value.toJSON() as any) as Drawable;
        drawable.key = ev.value.key;
        return drawable;
    }
}
