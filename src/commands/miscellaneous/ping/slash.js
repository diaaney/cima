const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check Cima's latency 🏓"),

    async execute(interaction) {
        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        const latency = Date.now() - interaction.createdTimestamp;
        const wsPing = interaction.client.ws.ping;

        // Calculate uptime
        const uptime = Date.now() - interaction.client.readyTimestamp;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeFormatted = `${hours}h ${minutes}m`;

        // Update to success state with terminal-style format
        const message = `**PING CHECK**\n→ Respuesta inicial: ${latency}ms\n→ WebSocket: ${wsPing}ms\n→ Uptime: ${uptimeFormatted}`;

        await interaction.editReply({
            embeds: [embeds.success(message)]
        });
    }
};
