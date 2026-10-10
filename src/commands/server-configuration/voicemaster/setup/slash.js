const {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const path = require('path');
const { setVoicemasterConfig } = require('../../../../utils/storage');
const embeds = require('../../../../constants/embeds');
const { markup, id } = require('../../../../constants/appEmojis');

const vmLogoPath = 'attachment://vm-logo.png';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicemaster')
        .setDescription('Setup your VoiceMaster system')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Create VoiceMaster category and panel')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { guild } = interaction;

        // Show thinking state with random verb
        await interaction.reply({
            embeds: [embeds.thinking()],
            ephemeral: true
        });

        // Crear categoría
        const category = await guild.channels.create({
            name: '📞 voice channels',
            type: ChannelType.GuildCategory,
        });

        // Canal generador
        const generatorChannel = await guild.channels.create({
            name: 'create',
            type: ChannelType.GuildVoice,
            parent: category.id,
        });

        // Canal de panel
        const panelChannel = await guild.channels.create({
            name: 'panel',
            type: ChannelType.GuildText,
            parent: category.id,
        });

        // Embed del panel
        const panelEmbed = new EmbedBuilder()
            .setAuthor({ name: 'VoiceMaster Interface', iconURL: guild.iconURL() })
            .setDescription(`Use the buttons below to control your voice channel.\n\n**Button Usage**\n` +
                `${markup('lock')} — **\`Lock\`** the voice channel\n` +
                `${markup('unlock')} — **\`Unlock\`** the voice channel\n` +
                `${markup('ghost')} — **\`Ghost\`** the voice channel\n` +
                `${markup('reveal')} — **\`Reveal\`** the voice channel\n` +
                `${markup('claim')} — **\`Claim\`** the voice channel\n` +
                `${markup('disconnect')} — **\`Disconnect\`** a member\n` +
                `${markup('start')} — **\`Start\`** an activity\n` +
                `${markup('info')} — **\`View\`** channel information\n` +
                `${markup('increase')} — **\`Increase\`** the user limit\n` +
                `${markup('decrease')} — **\`Decrease\`** the user limit`
            )
            .setColor(embeds.NEUTRAL_COLOR)
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
            files: [path.join(__dirname, '..', 'assets', 'vm-logo.png')]
        });

        // Save config to JSON
        setVoicemasterConfig(guild.id, generatorChannel.id, category.id, panelChannel.id);

        // Update to success state
        await interaction.editReply({
            embeds: [embeds.success('VoiceMaster setup completed!')]
        });
    }
};
