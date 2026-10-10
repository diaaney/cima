const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');

module.exports = {
    id: 'vm_decrease',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({ embeds: [embeds.error('You do not own this channel.')], ephemeral: true });
        }

        if (channel.userLimit === 0) {
            return interaction.reply({ embeds: [embeds.error('User limit is already unlimited.')], ephemeral: true });
        }

        const newLimit = channel.userLimit - 1;
        await channel.setUserLimit(newLimit);
        return interaction.reply({ embeds: [embeds.success(`User limit decreased to ${newLimit}.`)], ephemeral: true });
    }
};
