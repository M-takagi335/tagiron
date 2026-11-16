import { decide } from './npc.ts';
import type { NpcView } from './npc.ts';

const worker = self;
worker.onmessage = (event: MessageEvent<NpcView>) => worker.postMessage(decide(event.data));
