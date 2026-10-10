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
        } catch (error) {
            console.warn(`[Verification] Could not DM ${interaction.user.id}: ${error.code || 'unknown'} ${error.message}`);
            const message = error.code === 50007
                ? 'Discord bloqueó mi MD. En tu cuenta, permite los mensajes directos de miembros de este servidor y comprueba que no hayas bloqueado a Cima.'
                : 'No pude enviarte el MD por un error. Inténtalo de nuevo en un momento.';
            return interaction.editReply({ embeds: [embeds.error(message)] });
        }
    },
};
