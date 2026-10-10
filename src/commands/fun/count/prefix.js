const { PermissionFlagsBits } = require('discord.js');
const { setCountingChannel } = require('../../../utils/storage');

module.exports = {
    name: 'count',
    aliases: [],
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args) {
        if (!args[0] || args[0].toLowerCase() !== 'setup') {
            return message.reply({
                embeds: [{
                    color: 0xa82d43,
                    description: '❌ Usage: `!count setup`'
                }]
            });
        }

        const channel = message.channel;

        // Set this channel as the counting channel
        setCountingChannel(message.guild.id, channel.id);

        message.reply({
            embeds: [{
                color: 0x7ab158,
                description: `✅ Counting game enabled in ${channel}!\n\n` +
                    `**Rules:**\n` +
                    `• Count from 1, 2, 3, etc.\n` +
                    `• Each user must take turns (can't count twice in a row)\n` +
                    `• If someone sends the wrong number, count resets to 0\n` +
                    `• ✅ = Correct | ❌ = Wrong (resets count)`
            }]
        });
    }
};
