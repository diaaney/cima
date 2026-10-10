const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');

module.exports = {
    id: 'vm_lock',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({
                embeds: [embeds.error('You do not own this channel.')],
                ephemeral: true
            });
        }

        // Lock for everyone
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });

        // Ensure owner keeps their permissions including MoveMembers
        await channel.permissionOverwrites.edit(interaction.user.id, {
            Connect: true,
            ManageChannels: true,
            MoveMembers: true
        });

        return interaction.reply({
            embeds: [embeds.success('Channel locked.')],
            ephemeral: true
        });
    }
};
