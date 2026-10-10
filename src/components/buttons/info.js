const { isOwner } = require('./common');
const embeds = require('../../constants/embeds');

module.exports = {
    id: 'vm_info',
    async execute(interaction) {
        const channel = interaction.member.voice?.channel;
        if (!channel || !isOwner(channel.id, interaction.user.id)) {
            return interaction.reply({ embeds: [embeds.error('You do not own this channel.')], ephemeral: true });
        }

        const owner = `<@${interaction.user.id}>`;
        const locked = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has('Connect') ? 'Yes' : 'No';
        const hidden = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has('ViewChannel') ? 'Yes' : 'No';

        const embed = embeds.info(
            `**Channel Name:** ${channel.name}\n` +
            `**Owner:** ${owner}\n` +
            `**Locked:** ${locked}\n` +
            `**Hidden:** ${hidden}\n` +
            `**Bitrate:** ${channel.bitrate / 1000} kbps\n` +
            `**Users:** ${channel.members.size}/${channel.userLimit || '∞'}\n` +
            `**Created:** <t:${Math.floor(channel.createdTimestamp / 1000)}:R>`
        );

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
