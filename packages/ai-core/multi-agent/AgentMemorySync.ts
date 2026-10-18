export class AgentMemorySync {
 sync(source:Record<string,unknown>,target:Record<string,unknown>){Object.assign(target,source);return target;}
}
