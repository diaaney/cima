const { EmbedBuilder, Events } = require('discord.js');
const embeds = require('../constants/embeds');
const { getWelcomeConfig, getAutoroleConfig } = require('../utils/storage');
const { buildWelcomeDescription } = require('../utils/welcomeMessage');

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

        try {
            // Get welcome configuration
            const welcomeConfig = getWelcomeConfig(member.guild.id);

            // If no welcome channel is configured, do nothing
            if (!welcomeConfig.channel_id) {
                return;
            }

            // Get the welcome channel
            const welcomeChannel = await member.guild.channels.fetch(welcomeConfig.channel_id);

            if (!welcomeChannel) {
                console.error('Welcome channel not found');
                return;
            }

            // Get user info
            const user = member.user;
            const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 });

            // Create welcome embed
            const welcomeEmbed = new EmbedBuilder()
                .setColor(embeds.NEUTRAL_COLOR)
                .setAuthor({
                    name: `wlc ${member.displayName} <3`,
                    iconURL: avatarURL
                })
                .setDescription(buildWelcomeDescription(member.guild))
                .setThumbnail(avatarURL)
                .setFooter({ text: `users | ${member.guild.memberCount}` });

            // Optional embed image (does not replace the user avatar)
            if (welcomeConfig.image_url) {
                welcomeEmbed.setImage(welcomeConfig.image_url);
            }

            // Send welcome message with user mention
            await welcomeChannel.send({
                content: `${member}`,
                embeds: [welcomeEmbed]
            });

        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    });

    console.log('✅ Welcome event handler loaded');
};
