class Deque {
  constructor(maxLength) {
    this.maxLength = maxLength;
    this.items = [];
  }

  get() {
    return this.items;
  }

  push(item) {
    this.items.push(item);
    if (this.items.length > this.maxLength) {
      this.items.shift();
    }
  }

  pop() {
    return this.items.pop();
  }

  shift() {
    return this.items.shift();
  }

  unshift(item) {
    this.items.unshift(item);
    if (this.items.length > this.maxLength) {
      this.items.pop();
    }
  }

  length() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }
}

module.exports = {Deque}