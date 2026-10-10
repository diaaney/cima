const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');

module.exports = {
    id: 'vm_increase',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({ embeds: [embeds.error('You do not own this channel.')], ephemeral: true });
        }

        const newLimit = (channel.userLimit || 0) + 1;
        await channel.setUserLimit(newLimit);
        return interaction.reply({ embeds: [embeds.success(`User limit increased to ${newLimit}.`)], ephemeral: true });
    }
};
