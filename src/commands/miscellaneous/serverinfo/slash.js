const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('check server stats and info'),

    async execute(interaction) {
        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        const guild = interaction.guild;

        // Calculate member stats
        const totalMembers = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;

        // Calculate channel stats
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;

        // Get boost info
        const boostLevel = guild.premiumTier;
        const boostCount = guild.premiumSubscriptionCount || 0;

        // Calculate server age
        const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

        // Build terminal-style message
        const message = `**SERVER INFO**\n` +
            `→ Name: ${guild.name}\n` +
            `→ Owner: <@${guild.ownerId}>\n` +
            `→ Created: <t:${createdTimestamp}:R>\n` +
            `→ Members: ${totalMembers} (${humans} humans, ${bots} bots)\n` +
            `→ Channels: ${textChannels} text, ${voiceChannels} voice, ${categories} categories\n` +
            `→ Roles: ${guild.roles.cache.size}\n` +
            `→ Boost: level ${boostLevel} (${boostCount} boosts)`;

        await interaction.editReply({
            embeds: [embeds.success(message)]
        });
    }
};
