const parseFlags = require('../../../core/FlagParser');
const embeds = require('../../../constants/embeds');

module.exports = {
    name: 'ping',
    description: 'Check Cima’s latency 🏓',
    async execute(message, args) {
        const { flags } = parseFlags(args);
        const silent = flags.silent || flags.s === true;

        const sent = await message.channel.send('Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;

        if (!silent) {
            sent.edit({ embeds: [embeds.success(`Pong! Latency is **${latency}ms**`)] });
        } else {
            sent.delete();
        }
    }
};
