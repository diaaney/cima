const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');

module.exports = {
    id: 'vm_reveal',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({ embeds: [embeds.error('You do not own this channel.')], ephemeral: true });
        }

        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
        return interaction.reply({ embeds: [embeds.success('Channel revealed.')], ephemeral: true });
    }
};
