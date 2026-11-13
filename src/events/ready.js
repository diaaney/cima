const { ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createBackup, pruneDailyBackups } = require('../utils/backupSqlite');

const BACKUP_EVERY_MS = 6 * 60 * 60 * 1000;

async function backupData() {
    const directory = path.join(__dirname, '..', '..', 'data', 'backups');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    try {
        await createBackup(path.join(directory, `daily-${stamp}.sqlite`));
        pruneDailyBackups(directory);
    } catch (error) {
        console.error('[Cima] No se pudo crear la copia de SQLite:', error);
    }
}

// Rotating school-themed presences
const STATUSES = [
    { name: 'Expulsando a SAFIM', type: ActivityType.Competing },
    { name: 'Verificando usuarios...', type: ActivityType.Watching },
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
        fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'runtime-ready.json'), JSON.stringify({
            startedAt: new Date().toISOString(),
            userId: client.user.id,
        }));
        void backupData();
        setInterval(() => void backupData(), BACKUP_EVERY_MS);

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
