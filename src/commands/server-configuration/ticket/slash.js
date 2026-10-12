const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { panelEmbed, panelButtons } = require('../../../utils/ticketViews');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Administra el panel de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand
            .setName('panel')
            .setDescription('Publica el panel de soporte en este canal')),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                embeds: [embeds.error('Solo los administradores pueden publicar el panel de tickets.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const message = await interaction.channel.send({
            embeds: [panelEmbed()],
            components: panelButtons(),
            allowedMentions: { parse: [] },
        });
        await interaction.editReply({ content: `Panel de tickets publicado: ${message.url}` });
    },
};
