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

        const commands = new (fabric as any).Path(p.d3).path;

        // check if the path is a dot
        if (commands.length === 2 && commands[1][0] === 'A') {
            const moveCommand = commands[0];
            const centerX = moveCommand[1];
            const centerY = moveCommand[2];

            return new NormalPenDot([centerX, centerY], options);
        }

        const correctedCommands = commands.map((cmd: string[]) => {
            if (cmd[0] === 'Q') { // MathElf represents quadratic curve with endpoind and control point reversed compared to svg standard
                return [cmd[0], cmd[3], cmd[4], cmd[1], cmd[2]];
            } else {
                return cmd;
            }
        });

        return new NormalPenPath(correctedCommands, options);
    }
}
