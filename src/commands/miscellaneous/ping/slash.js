const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check Cima's latency 🏓"),

    async execute(interaction) {
        // Calculate actual latency (before deferring)
        const startTime = Date.now();

        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        const latency = Date.now() - interaction.createdTimestamp;
        const wsPing = interaction.client.ws.ping;

        // Calculate uptime
        const uptime = Date.now() - interaction.client.readyTimestamp;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeFormatted = `${hours}h ${minutes}m`;

        // Animation delay (1600ms)
        await new Promise(resolve => setTimeout(resolve, 1600));

        // Update to success state with terminal-style format
        const message = `**PING CHECK**\n→ API: ${latency}ms\n→ WebSocket: ${wsPing}ms\n→ Uptime: ${uptimeFormatted}`;

        await interaction.editReply({
            embeds: [embeds.success(message)]
        });
    }
};
