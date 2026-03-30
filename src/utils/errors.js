export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DuplicateListenerError extends Error {
  constructor(name) {
    super(`Listener "${name}" is already registered`);
    this.name = "DuplicateListenerError";
  }
}

export class NotConnectedError extends Error {
  constructor() {
    super("Not connected to the server");
    this.name = "NotConnectedError";
  }
}

export class TimeoutError extends Error {
  constructor(subject) {
    super(`Request timed out${subject ? ` on subject "${subject}"` : ""}`);
    this.name = "TimeoutError";
  }
}
