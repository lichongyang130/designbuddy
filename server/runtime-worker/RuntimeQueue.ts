export class RuntimeQueue<T> {
  private queue: T[] = [];

  push(item: T) {
    this.queue.push(item);
  }

  pop() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }
}
