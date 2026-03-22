import { RelayDevice } from '../src/index.js';

const device = new RelayDevice({
    api_key: process.env.RELAY_API_KEY,
    secret: process.env.RELAY_SECRET,
    mode: process.env.RELAY_MODE || 'test',
});

device.connection.listeners((event) => {
    console.log(`[connection] ${event.type}`);
});

async function main() {
    const connected = await device.connect();
    if (!connected) {
        console.error('Failed to connect');
        process.exit(1);
    }

    console.log('Connected. Publishing telemetry every 5s...');
    console.log(await device.config.get())

    const interval = setInterval(async () => {
        const temperature = +(20 + Math.random() * 15).toFixed(2);
        const humidity = +(30 + Math.random() * 50).toFixed(2);

        const [tempOk, humOk] = await Promise.all([
            device.telemetry.publish('temperature', temperature),
            device.telemetry.publish('humidity', humidity),
        ]);

        console.log(`[telemetry] temp=${temperature}°C (${tempOk ? 'sent' : 'buffered'}) | humidity=${humidity}% (${humOk ? 'sent' : 'buffered'})`);
    }, 5000);

    device.rpc.listen('reboot_device', (req) => {
        console.log("Rebooting....")
        console.log("Device rebooted!")

        var data = req.payload;

        console.log(data)

        req.respond({
            status: "REBOOT_OK",
            timestamp: Date.now()
        })
    })

    device.command.listen('setConfig', (msg) => {
        console.log(msg.payload)
    })

    process.on('SIGINT', async () => {
        clearInterval(interval);
        await device.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    });
}

main();
