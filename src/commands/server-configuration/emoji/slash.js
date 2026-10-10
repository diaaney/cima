const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../../constants/embeds');

// Matches a custom Discord emoji: <:name:id> or <a:name:id>
const CUSTOM_EMOJI_RE = /<(a)?:(\w{2,32}):(\d{15,25})>/;

function sanitizeName(raw, fallbackId) {
    let name = (raw || '').replace(/[^\w]/g, '_').slice(0, 32);
    if (name.length < 2) name = `emoji_${fallbackId.slice(-6)}`;
    return name;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('manage this server\'s emojis')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('clone a custom emoji into this server')
                .addStringOption(opt =>
                    opt.setName('emoji')
                        .setDescription('paste the custom emoji you want to add')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('name for the new emoji (optional)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'add') return;

        const { guild } = interaction;

        // The actor needs Manage Expressions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
            return interaction.reply({
                embeds: [embeds.error('you need the **Manage Expressions** permission to add emojis')],
                ephemeral: true
            });
        }

        // The bot needs Manage Expressions
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
            return interaction.reply({
                embeds: [embeds.error('i need the **Manage Expressions** permission to add emojis here')],
                ephemeral: true
            });
        }

        const raw = (interaction.options.getString('emoji') || '').trim();
        const match = raw.match(CUSTOM_EMOJI_RE);

        if (!match) {
            return interaction.reply({
                embeds: [embeds.error(
                    'that\'s not a custom emoji i can clone. paste a **custom** emoji (the kind with a name), ' +
                    'not a default unicode one like 😄'
                )],
                ephemeral: true
            });
        }

        const animated = Boolean(match[1]);
        const sourceName = match[2];
        const emojiId = match[3];
        const name = sanitizeName(interaction.options.getString('name') || sourceName, emojiId);

        const url = `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'png'}?size=128&quality=lossless`;

        await interaction.deferReply({ ephemeral: true });

        try {
            const created = await guild.emojis.create({ attachment: url, name });
            return interaction.editReply({
                embeds: [embeds.success(`added ${created} as \`:${created.name}:\` ✨`)]
            });
        } catch (err) {
            console.error('[Emoji] failed to create emoji:', err);

            let msg = 'couldn\'t add that emoji. try again or use a different one.';
            const code = err?.code;
            if (code === 30008) {
                msg = 'this server has hit its emoji limit — free a slot and try again.';
            } else if (code === 50138 || code === 50045) {
                msg = 'that image is too large to be an emoji (256kb max).';
            } else if (code === 50035) {
                msg = 'that emoji name isn\'t valid — try passing a simpler `name`.';
            } else if (err?.rawError?.message) {
                msg = `couldn't add that emoji: ${err.rawError.message}`;
            }

            return interaction.editReply({ embeds: [embeds.error(msg)] });
        }
    }
};
