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
            .setAuthor({ name: 'VoiceMaster • voice chat', iconURL: guild.iconURL() })
            .setDescription(
                `Personaliza tu voice chat con estos controles:\n\n**Controles**\n` +
                `${markup('lock')} — **\`Lock\`** · Bloquea la entrada a tu canal.\n` +
                `${markup('unlock')} — **\`Unlock\`** · Permite que vuelvan a entrar.\n` +
                `${markup('ghost')} — **\`Ghost\`** · Oculta tu canal a los demás.\n` +
                `${markup('reveal')} — **\`Reveal\`** · Vuelve a mostrar tu canal.\n` +
                `${markup('claim')} — **\`Claim\`** · Reclama el canal en el que estás.\n` +
                `${markup('disconnect')} — **\`Disconnect\`** · Saca a alguien de tu canal.\n` +
                `${markup('start')} — **\`Start\`** · Te indica cómo iniciar actividades desde Discord.\n` +
                `${markup('info')} — **\`Info\`** · Muestra los datos de tu canal.\n` +
                `${markup('increase')} — **\`Increase\`** · Sube el límite de usuarios.\n` +
                `${markup('decrease')} — **\`Decrease\`** · Baja el límite de usuarios.`
            )
            .setColor('#3c3b40')
            .setThumbnail(vmLogoPath)
            .setFooter({ text: 'VoiceMaster by UABC' });

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
