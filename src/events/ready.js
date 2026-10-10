const { ActivityType } = require('discord.js');

// Rotating school-themed presences
const STATUSES = [
    { name: 'Expulsando a SAFIM', type: ActivityType.Competing },
    { name: 'Verificando Usuarios...', type: ActivityType.Watching },
    { name: 'Salvando Inglés II', type: ActivityType.Playing },
    { name: 'Sobreviviendo a parciales', type: ActivityType.Competing },
    { name: 'Buscando el salón', type: ActivityType.Watching },
    { name: 'Haciendo la tarea a las 11:59', type: ActivityType.Playing },
    { name: 'Esperando al profe', type: ActivityType.Watching },
    { name: 'Evitando extraordinarios', type: ActivityType.Competing },
];

const ROTATE_EVERY_MS = 30_000; // switch status every 30s

module.exports = (client) => {
    client.once('ready', async () => {
        console.log(`✅ Cima está lista como ${client.user.tag}`);

        let index = 0;

        const apply = () => {
            const status = STATUSES[index];
            client.user.setPresence({
                activities: [status],
                status: 'online'
            });
            console.log(`💜 Status set to: ${ActivityType[status.type]} "${status.name}"`);
            index = (index + 1) % STATUSES.length;
        };

        // Set the first status immediately, then rotate on an interval
        apply();
        setInterval(apply, ROTATE_EVERY_MS);
    });
};
