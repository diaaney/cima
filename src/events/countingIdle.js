const { getCountingConfig, markCountingIdleAnnounced } = require('../utils/storage');
const { buildLeaderboard } = require('../utils/leaderboards');

const IDLE_MS = 3 * 60_000;
const CHECK_EVERY_MS = 15_000;

function isIdleDue(counting, now = Date.now()) {
    return Boolean(counting.channel_id && counting.current_number > 0 &&
        counting.last_count_at && counting.idle_announced_for !== counting.last_count_at &&
        now - counting.last_count_at >= IDLE_MS);
}

async function checkCountingIdle(client, inFlight = new Set(), now = Date.now()) {
    for (const guild of client.guilds.cache.values()) {
        const counting = getCountingConfig(guild.id);
        if (!isIdleDue(counting, now) || inFlight.has(guild.id)) continue;

        inFlight.add(guild.id);
        try {
            const channel = await client.channels.fetch(counting.channel_id);
            if (!channel?.isTextBased() || !isIdleDue(getCountingConfig(guild.id), now)) continue;

            const latest = getCountingConfig(guild.id);
            if (latest.last_count_at !== counting.last_count_at || latest.current_number !== counting.current_number) continue;

            await channel.send({
                content: `⏳ Llevamos 3 minutos sin contar. Nos quedamos en el **${counting.current_number.toLocaleString('es-MX')}**; sigue el **${(counting.current_number + 1).toLocaleString('es-MX')}**.`,
                embeds: [buildLeaderboard('counting', guild)],
                allowedMentions: { parse: [] },
            });
            markCountingIdleAnnounced(guild.id, counting.last_count_at);
        } catch (error) {
            console.error(`[Counting] No pude enviar el aviso de inactividad en ${guild.id}:`, error);
        } finally {
            inFlight.delete(guild.id);
        }
    }
}

module.exports = client => {
    client.once('ready', () => {
        const inFlight = new Set();
        const check = () => checkCountingIdle(client, inFlight).catch(error => {
            console.error('[Counting] Falló la revisión de inactividad:', error);
        });
        void check();
        setInterval(check, CHECK_EVERY_MS);
    });
};

module.exports.isIdleDue = isIdleDue;
module.exports.checkCountingIdle = checkCountingIdle;
