const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { sendPrompt } = require('../../../events/verification');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar')
        .setDescription('Recibe por MD los pasos para verificar tu correo UABC'),
    async execute(interaction) {
        if (interaction.guildId !== process.env.GUILD_ID?.trim()) {
            return interaction.reply({ embeds: [embeds.error('Este comando solo funciona en Comunidad UABC.')], ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            await sendPrompt(interaction.user, interaction.guild.name);
            return interaction.editReply({ embeds: [embeds.success('Te envié las instrucciones por MD ♡')] });
        } catch {
            return interaction.editReply({ embeds: [embeds.error('No pude enviarte un MD. Activa los mensajes directos del servidor e inténtalo de nuevo.')] });
        }
    },
};
