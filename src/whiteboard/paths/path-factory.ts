import * as Fabric from 'fabric';
const fabric = (Fabric as any).fabric as typeof Fabric;

import { PathDrawable } from '../data-retriever';
import { NormalPenDot } from './normal-pen-dot';
import { NormalPenPath } from './normal-pen-path';

export abstract class PathFactory {
    static parsePath(p: PathDrawable) {
        const options = {} as { [key: string]: any };

        if (p.isEraser) {
            options.globalCompositeOperation = 'destination-out';
            options.color = 'rgba(0,0,0,1)';
        } else {
            options.globalCompositeOperation = 'source-over';
            if (p.strokeColor) {
                options.color = `rgba(${p.strokeColor},${p.strokeOpacity})`;
            } else {
                options.color = 'rgba(0,0,0,0)';
            }
        }
        options.strokeWidth = p.strokeWidth;

        const path = p.d3 || Object.keys(p.d2).map(k => (p.d2 as any)[k]).join('|');
        const commands = new (fabric as any).Path(path).path;

        // check if the path is a dot
        if (commands.length === 2 && commands[1][0] === 'A') {
            const moveCommand = commands[0];
            const centerX = moveCommand[1];
            const centerY = moveCommand[2];

            return new NormalPenDot([centerX, centerY], options);
        }

        const correctedCommands = commands.map((cmd: string[]) => {
            // MathElf represents quadratic curves with the endpoint and control point reversed,
            // compared to svg standard
            if (cmd[0] === 'Q') {
                return [cmd[0], cmd[3], cmd[4], cmd[1], cmd[2]];
            } else {
                return cmd;
            }
        });

        return new NormalPenPath(correctedCommands, options);
    }
}
