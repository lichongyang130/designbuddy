export class ExperienceReplay<T>{private buffer:T[]=[]; add(item:T){this.buffer.push(item);} sample(){return this.buffer;}}
