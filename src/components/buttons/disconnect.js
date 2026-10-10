const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    id: 'vm_disconnect',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({ embeds: [embeds.error('You do not own this channel.')], ephemeral: true });
        }

        const members = channel.members.filter(m => !m.user.bot);
        if (members.size === 0) {
            return interaction.reply({ embeds: [embeds.warn('There are no users to disconnect.')], ephemeral: true });
        }

        const options = members.map(m => ({
            label: m.user.username,
            value: m.id
        }));

        const select = new StringSelectMenuBuilder()
            .setCustomId('vm_disconnect_select')
            .setPlaceholder('Select a user to disconnect')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        return interaction.reply({
            content: '**🪝 Choose a user to disconnect:**',
            components: [row],
            ephemeral: true
        });
    }
};
