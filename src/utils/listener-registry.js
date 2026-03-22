export class ListenerRegistry {

    #listeners = new Map();

    register(name, callback) {
        if (this.#listeners.has(name)) {
            return false;
        }
        this.#listeners.set(name, { callback, subscription: null });
        return true;
    }

    unregister(name) {
        if (!this.#listeners.has(name)) {
            return false;
        }
        this.#listeners.delete(name);
        return true;
    }

    has(name) {
        return this.#listeners.has(name);
    }

    get(name) {
        return this.#listeners.get(name);
    }

    setSubscription(name, subscription) {
        const entry = this.#listeners.get(name);
        if (entry) {
            entry.subscription = subscription;
        }
    }

    entries() {
        return this.#listeners.entries();
    }
}
