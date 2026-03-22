import { SubjectBuilder } from "../utils/subject-builder.js";

export class EventManager {

    #transport;

    constructor(transport) {
        this.#transport = transport;
    }

    async send(eventName, data) {
        const subject = SubjectBuilder.event(
            this.#transport.getOrgId(),
            this.#transport.getEnv(),
            this.#transport.getDeviceId(),
            eventName,
        );

        return this.#transport.publish(subject, data);
    }
}
