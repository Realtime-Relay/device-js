import { SubjectBuilder } from "../utils/subject-builder.js";

export class EventManager {
  #transport;
  #time;

  constructor(transport, time) {
    this.#transport = transport;
    this.#time = time;
  }

  async send(eventName, data) {
    const subject = SubjectBuilder.event(
      this.#transport.getOrgId(),
      this.#transport.getEnv(),
      this.#transport.getDeviceId(),
      eventName,
    );

    return this.#transport.publish(subject, {
      value: data,
      timestamp: this.#time.now(),
    });
  }
}
