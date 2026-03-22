import { ValidationError } from "./errors.js";

const VALID_MODES = ['test', 'production'];

export class Validators {

    validateDeviceConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new ValidationError('Config must be a non-null object');
        }

        this.#requireNonEmpty(config, 'api_key');
        this.#requireNonEmpty(config, 'secret');
        this.#requireNonEmpty(config, 'mode');

        if (!VALID_MODES.includes(config.mode)) {
            throw new ValidationError(`mode must be one of: ${VALID_MODES.join(', ')}`);
        }
    }

    #requireNonEmpty(config, field) {
        const value = config[field];
        if (value === null || value === undefined || value === '') {
            throw new ValidationError(`${field} must not be null, undefined, or empty`);
        }
    }
}
