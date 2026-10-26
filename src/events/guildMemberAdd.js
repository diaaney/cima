const { EmbedBuilder, Events } = require('discord.js');
const embeds = require('../constants/embeds');
const { getWelcomeConfig, getAutoroleConfig } = require('../utils/storage');
const { buildWelcomeDescription } = require('../utils/welcomeMessage');

async function sendWelcomeMessage(member) {
    const welcomeConfig = getWelcomeConfig(member.guild.id);
    if (!welcomeConfig.channel_id) return;

    const welcomeChannel = await member.guild.channels.fetch(welcomeConfig.channel_id);
    if (!welcomeChannel) throw new Error('Welcome channel not found');

    const avatarURL = member.user.displayAvatarURL({ dynamic: true, size: 256 });
    const welcomeEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setAuthor({ name: `wlc ${member.displayName} !!`, iconURL: avatarURL })
        .setDescription(buildWelcomeDescription(member.guild))
        .setThumbnail(avatarURL)
        .setFooter({ text: `users | ${member.guild.memberCount}` });

    if (welcomeConfig.image_url) welcomeEmbed.setImage(welcomeConfig.image_url);
    await welcomeChannel.send({ content: `${member}`, embeds: [welcomeEmbed] });
}

module.exports = (client) => {
    client.on(Events.GuildMemberAdd, async (member) => {
        // Autorole: give configured role to the new member
        try {
            const autoroleConfig = getAutoroleConfig(member.guild.id);
            if (autoroleConfig.role_id && !member.user.bot) {
                const role = await member.guild.roles.fetch(autoroleConfig.role_id).catch(() => null);
                if (role) {
                    await member.roles.add(role, 'autorole via /role join').catch(err => {
                        console.error('[Autorole] failed to assign role:', err.message);
                    });
                }
            }
        } catch (error) {
            console.error('[Autorole] error:', error);
        }
    });

    console.log('✅ Autorole event handler loaded');
};

module.exports.sendWelcomeMessage = sendWelcomeMessage;
