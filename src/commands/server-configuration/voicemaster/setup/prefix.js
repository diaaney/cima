const {
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const path = require('path');
const { setVoicemasterConfig } = require('../../../../utils/storage');
const { markup, id } = require('../../../../constants/appEmojis');

const vmLogoPath = 'attachment://vm-logo.png';

module.exports = {
    name: 'voicemaster',
    aliases: [],
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args) {
        if (!args[0] || args[0].toLowerCase() !== 'setup') {
            return message.reply({
                embeds: [{
                    color: 0xa82d43,
                    description: '❌ Usage: `voicemaster setup`'
                }]
            });
        }

        const { guild } = message;

        const category = await guild.channels.create({
            name: '📞 voice channels',
            type: ChannelType.GuildCategory,
        });

        const generatorChannel = await guild.channels.create({
            name: 'create',
            type: ChannelType.GuildVoice,
            parent: category.id,
        });

        const panelChannel = await guild.channels.create({
            name: 'panel',
            type: ChannelType.GuildText,
            parent: category.id,
        });

        const panelEmbed = new EmbedBuilder()
            .setAuthor({ name: 'VoiceMaster Interface', iconURL: guild.iconURL() })
            .setDescription(
                `Use the buttons below to control your voice channel.\n\n**Button Usage**\n` +
                `${markup('lock')} — \`Lock\` your channel\n` +
                `${markup('unlock')} — \`Unlock\` your channel\n` +
                `${markup('ghost')} — \`Ghost\` your channel\n` +
                `${markup('reveal')} — \`Reveal\` your channel\n` +
                `${markup('claim')} — \`Claim\` your channel\n` +
                `${markup('disconnect')} — \`Disconnect\` someone\n` +
                `${markup('start')} — \`Start\` an activity\n` +
                `${markup('info')} — \`Info\` about your channel\n` +
                `${markup('increase')} — \`Increase\` user limit\n` +
                `${markup('decrease')} — \`Decrease\` user limit`
            )
            .setColor('#3c3b40')
            .setThumbnail(vmLogoPath)
            .setFooter({ text: 'VoiceMaster by Cima' });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vm_lock').setEmoji(id('lock')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_unlock').setEmoji(id('unlock')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_ghost').setEmoji(id('ghost')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_reveal').setEmoji(id('reveal')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_claim').setEmoji(id('claim')).setStyle(ButtonStyle.Secondary),
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vm_disconnect').setEmoji(id('disconnect')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_activity').setEmoji(id('start')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_info').setEmoji(id('info')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_increase').setEmoji(id('increase')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_decrease').setEmoji(id('decrease')).setStyle(ButtonStyle.Secondary),
        );

        await panelChannel.send({
            embeds: [panelEmbed],
            components: [row1, row2],
            files: [path.join(__dirname, '..', 'assets', 'vm-logo.png')],
        });

        // Save config to JSON
        setVoicemasterConfig(guild.id, generatorChannel.id, category.id, panelChannel.id);

        message.reply({
            embeds: [{
                color: 0x7ab158,
                description: '✅ VoiceMaster setup completed!',
            }]
        });
    }
};
