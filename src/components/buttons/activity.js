const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    id: 'vm_activity',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({ embeds: [embeds.error('You do not own this channel.')], ephemeral: true });
        }

        const activities = [
            { label: 'YouTube Together', value: 'yt' },
            { label: 'Poker Night', value: 'poker' },
            { label: 'Chess in the Park', value: 'chess' },
            { label: 'Checkers', value: 'checkers' },
        ];

        const select = new StringSelectMenuBuilder()
            .setCustomId('vm_activity_select')
            .setPlaceholder('🎮 Select an activity (info only)')
            .addOptions(activities);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
            content: '**🕹️ Pick an activity:**',
            components: [row],
            ephemeral: true
        });

        setTimeout(() => {
            interaction.followUp({
                embeds: [embeds.info('Activities can only be started from the Discord app.')],
                ephemeral: true
            }).catch(() => {});
        }, 2000);
    }
};
