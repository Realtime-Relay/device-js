import { NotConnectedError } from "../utils/errors.js";
import { TransportStatus } from "../transport.js";
import { Client as NtpClient } from "ntp-time";

const NTP_SERVER = 'time.google.com';
const NTP_PORT = 123;
const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const NTP_EPOCH_OFFSET = 2208988800; // seconds between NTP epoch (1900) and Unix epoch (1970)

export class TimeManager {

    #transport;
    #active = false;
    #offsetMs = 0;
    #lastSyncAt = 0;
    #timezone = null;

    constructor(transport) {
        this.#transport = transport;

        this.#transport.onStatus((event) => {
            this.#active = event.type === TransportStatus.CONNECTED
                || event.type === TransportStatus.RECONNECTED;

            if (this.#active && this.#isSyncStale()) {
                this.init();
            }
        });
    }

    #requireConnection() {
        if (!this.#active) {
            throw new NotConnectedError();
        }
    }

    #isSyncStale() {
        return (Date.now() - this.#lastSyncAt) >= SYNC_INTERVAL_MS;
    }

    async init() {
        this.#requireConnection();

        const client = new NtpClient(NTP_SERVER, NTP_PORT);

        const response = await client.syncTime();

        // response.time is NTP server time as Date, getTime() returns ms
        const ntpMs = response.time.getTime();
        const localMs = Date.now();

        this.#offsetMs = ntpMs - localMs;
        this.#lastSyncAt = Date.now();
    }

    now() {
        // return ms-precision corrected timestamp
        return Date.now() + this.#offsetMs;
    }

    toDate(timestamp) {
        // timestamp is in ms
        return new Date(timestamp);
    }

    toTimestamp(date) {
        // return ms
        return date.getTime();
    }

    setTimezone(tz) {
        this.#timezone = tz;
    }
}
