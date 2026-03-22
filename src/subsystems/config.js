import { SubjectBuilder } from "../utils/subject-builder.js";

export class ConfigManager {

    #transport;

    constructor(transport) {
        this.#transport = transport;
    }

    async get() {
        const subject = SubjectBuilder.configGet(this.#transport.getOrgId());

        const response = await this.#transport.request(subject, {
            id: this.#transport.getDeviceId(),
        });

        if (response.status === 'DEVICE_CONFIG_FETCH_SUCCESS') {
            return response.data.config;
        }

        return null;
    }

    async set(data) {
        const subject = SubjectBuilder.configSet(this.#transport.getOrgId());

        const response = await this.#transport.request(subject, {
            id: this.#transport.getDeviceId(),
            config: data,
        });

        return response.status === 'DEVICE_CONFIG_UPDATE_SUCCESS';
    }
}
