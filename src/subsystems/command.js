import { ListenerRegistry } from "../utils/listener-registry.js";
import { DuplicateListenerError, ValidationError } from "../utils/errors.js";
import { SubjectBuilder } from "../utils/subject-builder.js";

export class CommandManager {

    #transport;
    #registry = new ListenerRegistry();

    constructor(transport) {
        this.#transport = transport;
    }

    async listen(name, callback) {
        if (typeof callback !== 'function') {
            throw new ValidationError('callback must be a function');
        }

        if (this.#registry.has(name)) {
            throw new DuplicateListenerError(name);
        }

        const subject = SubjectBuilder.command(
            this.#transport.getOrgId(),
            this.#transport.getEnv(),
            this.#transport.getDeviceId(),
            name,
        );

        const subscription = await this.#transport.subscribe(subject, (data) => {
            callback({ payload: data });
        });

        this.#registry.register(name, callback);
        this.#registry.setSubscription(name, subscription);
    }

    async off(name) {
        const entry = this.#registry.get(name);
        if (!entry) {
            return false;
        }

        if (entry.subscription) {
            await this.#transport.unsubscribe(entry.subscription);
        }

        this.#registry.unregister(name);
        return true;
    }
}
