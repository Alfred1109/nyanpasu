/**
 * High-performance circular buffer implementation for WebSocket data
 * Replaces inefficient array.shift() operations with O(1) operations
 */
export class CircularBuffer<T> {
  private buffer: T[]
  private head = 0
  private tail = 0
  private size = 0
  private readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  /**
   * Add item to buffer (O(1) operation)
   */
  push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity

    if (this.size < this.capacity) {
      this.size++
    } else {
      // Buffer is full, move head forward (overwrites oldest item)
      this.head = (this.head + 1) % this.capacity
    }
  }

  /**
   * Get all items as array (maintains insertion order)
   */
  toArray(): T[] {
    if (this.size === 0) return []

    const result: T[] = new Array(this.size)

    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity
      result[i] = this.buffer[index]
    }

    return result
  }

  /**
   * Get buffer length
   */
  length(): number {
    return this.size
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.head = 0
    this.tail = 0
    this.size = 0
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0
  }

  /**
   * Check if buffer is at capacity
   */
  isFull(): boolean {
    return this.size === this.capacity
  }

  /**
   * Get the latest (most recent) item
   */
  getLatest(): T | undefined {
    if (this.size === 0) return undefined

    const latestIndex = this.tail === 0 ? this.capacity - 1 : this.tail - 1
    return this.buffer[latestIndex]
  }

  /**
   * Get items in reverse order (latest first) for performance-critical scenarios
   */
  getReversed(count?: number): T[] {
    if (this.size === 0) return []

    const itemCount = Math.min(count || this.size, this.size)
    const result: T[] = new Array(itemCount)

    for (let i = 0; i < itemCount; i++) {
      const index = this.tail - 1 - i
      const bufferIndex = index < 0 ? this.capacity + index : index
      result[i] = this.buffer[bufferIndex]
    }

    return result
  }
}
