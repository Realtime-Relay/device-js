import { RelayDevice } from '../src/index.js';

const device = new RelayDevice({
    api_key: process.env.RELAY_API_KEY,
    secret: process.env.RELAY_SECRET,
    mode: process.env.RELAY_MODE || 'test',
});

device.connection.listeners((event) => {
    console.log(`[connection] ${event.type}`);
});

/**
 * Temperature profile to test THRESHOLD alert with:
 *   value: 85, duration: 5s, recovery_duration: 10s, cooldown: 10s
 *
 * Timeline (1s intervals):
 *   0-4s    → ~70°C  (normal — baseline)
 *   5-64s   → ~90°C  (breach for 60s — alert should FIRE after 5s = ~10s mark)
 *   65-79s  → ~60°C  (recovery for 15s — alert should RESOLVE after 10s = ~75s mark)
 *   80+     → ~70°C  (back to normal, then exits)
 */
function getTemperature(elapsed) {
    const jitter = (Math.random() - 0.5) * 2; // ±1°C noise

    if (elapsed < 5)  return 70 + jitter;       // normal
    if (elapsed < 65) return 90 + jitter;       // breach 60s → fire
    if (elapsed < 80) return 60 + jitter;       // recovery 15s → resolved
    return 70 + jitter;                          // back to normal
}

async function main() {
    const connected = await device.connect();
    if (!connected) {
        console.error('Failed to connect');
        process.exit(1);
    }

    console.log('Connected. Running temperature profile for alert testing...\n');
    console.log('Alert config: threshold > 85°C, duration 5s, recovery 10s, cooldown 10s\n');

    const startTime = Date.now();
    let tick = 0;

    const interval = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const temperature = +getTemperature(elapsed).toFixed(2);
        const humidity = +(30 + Math.random() * 50).toFixed(2);

        const [tempOk, humOk] = await Promise.all([
            device.telemetry.publish('temperature', temperature),
            device.telemetry.publish('humidity', humidity),
        ]);

        const phase =
            elapsed < 5  ? 'NORMAL' :
            elapsed < 65 ? 'BREACH' :
            elapsed < 80 ? 'RECOVERY' : 'NORMAL';

        console.log(
            `[${elapsed.toFixed(0).padStart(3)}s] [${phase.padEnd(10)}] ` +
            `temp=${temperature}°C (${tempOk ? 'sent' : 'buff'}) | ` +
            `humidity=${humidity}% (${humOk ? 'sent' : 'buff'})`
        );

        tick++;
        if (elapsed > 85) {
            console.log('\nProfile complete.');
            clearInterval(interval);
            await device.disconnect();
            console.log('Disconnected.');
            process.exit(0);
        }
    }, 1000);

    device.rpc.listen('reboot_device', (req) => {
        console.log('Rebooting....');
        console.log('Device rebooted!');
        console.log(req.payload);
        req.respond({ status: 'REBOOT_OK', timestamp: Date.now() });
    });

    device.command.listen('setConfig', (msg) => {
        console.log(msg.payload);
    });

    process.on('SIGINT', async () => {
        clearInterval(interval);
        await device.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    });
}

main();
