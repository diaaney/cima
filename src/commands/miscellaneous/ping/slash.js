const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check Cima's latency 🏓"),

    async execute(interaction) {
        const receivedAt = Date.now();
        const gatewayDelay = Math.max(0, receivedAt - interaction.createdTimestamp);

        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        const acknowledgementDelay = Date.now() - receivedAt;
        const wsPing = interaction.client.ws.ping;

        // Calculate uptime
        const uptime = Date.now() - interaction.client.readyTimestamp;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeFormatted = `${hours}h ${minutes}m`;

        // Update to success state with terminal-style format
        const message = `**PING CHECK**\n→ Llegada del comando: ${gatewayDelay}ms\n→ Confirmación de Discord: ${acknowledgementDelay}ms\n→ WebSocket: ${wsPing}ms\n→ Uptime: ${uptimeFormatted}`;

        await interaction.editReply({
            embeds: [embeds.success(message)]
        });
    }
};
