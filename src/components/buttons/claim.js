const embeds = require('../../constants/embeds');
const { claimRoom } = require('../../utils/storage');

module.exports = {
    id: 'vm_claim',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel) {
            return interaction.reply({
                embeds: [embeds.error('You are not in a voice channel.')],
                ephemeral: true
            });
        }

        claimRoom(channel.id, interaction.user.id);
        await channel.setName(`${interaction.user.username}'s room`);

        return interaction.reply({
            embeds: [embeds.success('You claimed the channel.')],
            ephemeral: true
        });
    }
};
