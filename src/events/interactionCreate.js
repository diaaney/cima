const {
    Collection,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    Routes,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const embeds = require('../constants/embeds');
const {
    getRoom,
    getPersonalColor,
    setPersonalColor,
    getActiveBooster,
    getCountingConfig,
    applyBoostToCount,
    clearActiveBooster,
    getActiveDrop,
    clearActiveDrop,
    getUserStats,
    addItem,
    removeItem,
    unprimeItem,
} = require('../utils/storage');
const { applyBoost } = require('../utils/boosterOps');
const { ITEM_DEFS_BY_TYPE } = require('../utils/itemDrops');
const {
    BOOSTER_WIN_LINES,
    BOOSTER_FAIL_LINES,
    DROP_WIN_LINES,
    DROP_FAIL_LINES,
    pickLine,
    fillTokens,
} = require('../constants/countingLines');

function parseHexColor(input) {
    if (!input) return null;
    let hex = input.trim().replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return parseInt(hex, 16);
}

function isValidIconUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function detectImageMime(buf) {
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
    return null;
}

async function fetchIconAsDataUri(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`icon fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = detectImageMime(buf);
    if (!mime) throw new Error('icon format not recognized');
    return `data:${mime};base64,${buf.toString('base64')}`;
}

async function applyPersonalColor(interaction, { primaryColor, secondaryColor = null, customName = null, iconUrl = null }) {
    const member = interaction.member;
    const guild = interaction.guild;

    let roleId = getPersonalColor(guild.id, member.id);
    let role = roleId ? await guild.roles.fetch(roleId).catch(() => null) : null;

    const displayName = member.displayName || member.user.username;
    const baseName = customName || (role ? role.name : `🎨 ${displayName}`);

    const editOpts = { color: primaryColor, name: baseName };
    let iconApplied = false;

    if (iconUrl) {
        try {
            editOpts.icon = await fetchIconAsDataUri(iconUrl);
            iconApplied = true;
        } catch (err) {
            console.error('[Colors] icon fetch failed:', err.message);
        }
    }

    async function tryWrite() {
        if (role) {
            await role.edit(editOpts, 'personal color update');
        } else {
            role = await guild.roles.create({
                ...editOpts,
                hoist: false,
                mentionable: false,
                reason: `personal color role for ${member.user.tag}`
            });
            setPersonalColor(guild.id, member.id, role.id);
        }
    }

    try {
        await tryWrite();
    } catch (err) {
        if (editOpts.icon) {
            iconApplied = false;
            delete editOpts.icon;
            await tryWrite();
        } else {
            throw err;
        }
    }

    let gradientApplied = false;
    try {
        await interaction.client.rest.patch(
            Routes.guildRole(guild.id, role.id),
            {
                body: {
                    colors: {
                        primary_color: primaryColor,
                        secondary_color: secondaryColor,
                        tertiary_color: null
                    }
                },
                reason: secondaryColor !== null ? 'personal gradient' : 'personal solid color'
            }
        );
        gradientApplied = secondaryColor !== null;
    } catch (err) {
        if (secondaryColor !== null) {
            const e = new Error('gradient_unsupported');
            e.cause = err;
            throw e;
        }
    }

    // Position the color role just below the bot's highest role so the color shows.
    const botTop = guild.members.me?.roles?.highest;
    if (botTop && botTop.position > 1) {
        await role.setPosition(botTop.position - 1).catch(() => {});
    }

    if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
    }

    return { role, gradientApplied, iconApplied };
}

// Cargar todos los botones desde components/buttons/
const buttons = new Collection();
const buttonsPath = path.join(__dirname, '../components/buttons');
fs.readdirSync(buttonsPath).forEach(file => {
    const button = require(path.join(buttonsPath, file));
    if (button?.id && typeof button.execute === 'function') {
        buttons.set(button.id, button);
    }
});

module.exports = (client) => {
    client.on('interactionCreate', async interaction => {
        // Slash command
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(err);
                await interaction.reply({
                    embeds: [embeds.error('Error executing command.')],
                    ephemeral: true
                });
            }
            return;
        }

        // Botón
        if (interaction.isButton()) {
            // Counting booster claim
            if (interaction.customId.startsWith('booster_claim:')) {
                const boosterId = interaction.customId.slice('booster_claim:'.length);
                const guildId = interaction.guildId;
                const active = getActiveBooster(guildId);
                if (!active || active.id !== boosterId) {
                    return interaction.reply({
                        content: 'this booster is already resolved.',
                        ephemeral: true,
                    });
                }

                const stats = getUserStats(interaction.user.id);

                // Perfect aim: instant win, no modal
                if (stats.primed?.perfect_aim && (stats.items?.perfect_aim || 0) > 0) {
                    unprimeItem(interaction.user.id, 'perfect_aim');
                    removeItem(interaction.user.id, 'perfect_aim', 1);

                    const counting = getCountingConfig(guildId);
                    const fromCount = counting.current_number;
                    const toCount = applyBoost(fromCount, active.type, active.value);
                    applyBoostToCount(guildId, toCount);

                    const winLine = fillTokens(pickLine(BOOSTER_WIN_LINES), {
                        user: `<@${interaction.user.id}>`,
                        expression: active.expression,
                        answer: active.answer,
                        from: fromCount,
                        to: toCount,
                        type: active.type,
                    });

                    const channel = active.channel_id
                        ? await interaction.client.channels.fetch(active.channel_id).catch(() => null)
                        : null;
                    const originalMessage = (channel && active.message_id)
                        ? await channel.messages.fetch(active.message_id).catch(() => null)
                        : null;

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `🎯 perfect aim — \`${active.expression}\` = **${active.answer}** (${active.type}) — count jumped to **${toCount}**`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: `🎯 ${winLine}`,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.reply({
                        content: `🎯 perfect aim consumed — booster auto-won, count now **${toCount}**`,
                        ephemeral: true,
                    });
                }

                const useOracle = stats.primed?.oracle_eye && (stats.items?.oracle_eye || 0) > 0;
                if (useOracle) {
                    unprimeItem(interaction.user.id, 'oracle_eye');
                    removeItem(interaction.user.id, 'oracle_eye', 1);
                }

                const labelText = `answer for ${active.expression}`;
                const modal = new ModalBuilder()
                    .setCustomId(`booster_answer:${boosterId}`)
                    .setTitle('solve the booster');

                const input = new TextInputBuilder()
                    .setCustomId('booster_answer_input')
                    .setLabel(labelText.length > 45 ? `solve ${active.expression}`.slice(0, 45) : labelText)
                    .setPlaceholder(useOracle ? `🔮 oracle: answer is ${active.answer}` : 'your answer')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            // Counting item drop claim
            if (interaction.customId.startsWith('drop_claim:')) {
                const dropId = interaction.customId.slice('drop_claim:'.length);
                const guildId = interaction.guildId;
                const active = getActiveDrop(guildId);
                if (!active || active.id !== dropId) {
                    return interaction.reply({
                        content: 'this drop is already gone.',
                        ephemeral: true,
                    });
                }

                const labelText = `solve ${active.expression}`;
                const modal = new ModalBuilder()
                    .setCustomId(`drop_answer:${dropId}`)
                    .setTitle(`claim the ${active.label}`.slice(0, 45));

                const input = new TextInputBuilder()
                    .setCustomId('drop_answer_input')
                    .setLabel(labelText.length > 45 ? labelText.slice(0, 45) : labelText)
                    .setPlaceholder('your answer')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            // Solid color picker
            if (interaction.customId === 'colors_pick_solid') {
                const modal = new ModalBuilder()
                    .setCustomId('colors_modal_solid')
                    .setTitle('pick your color');

                const hexInput = new TextInputBuilder()
                    .setCustomId('colors_hex')
                    .setLabel('hex code')
                    .setPlaceholder('#ff66cc')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(3)
                    .setMaxLength(7)
                    .setRequired(true);

                const nameInput = new TextInputBuilder()
                    .setCustomId('colors_name')
                    .setLabel('role name (optional)')
                    .setPlaceholder('leave empty to keep current')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false);

                const iconInput = new TextInputBuilder()
                    .setCustomId('colors_icon')
                    .setLabel('icon PNG url (optional)')
                    .setPlaceholder('https://... — needs server boost lvl 2')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(500)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(hexInput),
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(iconInput)
                );
                return interaction.showModal(modal);
            }

            // Gradient picker
            if (interaction.customId === 'colors_pick_gradient') {
                const modal = new ModalBuilder()
                    .setCustomId('colors_modal_gradient')
                    .setTitle('pick your gradient');

                const primaryInput = new TextInputBuilder()
                    .setCustomId('colors_hex_primary')
                    .setLabel('first color (hex)')
                    .setPlaceholder('#ff66cc')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(3)
                    .setMaxLength(7)
                    .setRequired(true);

                const secondaryInput = new TextInputBuilder()
                    .setCustomId('colors_hex_secondary')
                    .setLabel('second color (hex)')
                    .setPlaceholder('#6666ff')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(3)
                    .setMaxLength(7)
                    .setRequired(true);

                const nameInput = new TextInputBuilder()
                    .setCustomId('colors_name')
                    .setLabel('role name (optional)')
                    .setPlaceholder('leave empty to keep current')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false);

                const iconInput = new TextInputBuilder()
                    .setCustomId('colors_icon')
                    .setLabel('icon PNG url (optional)')
                    .setPlaceholder('https://... — needs server boost lvl 2')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(500)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(primaryInput),
                    new ActionRowBuilder().addComponents(secondaryInput),
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(iconInput)
                );
                return interaction.showModal(modal);
            }

            const handler = buttons.get(interaction.customId);
            if (!handler) return;

            const userChannel = interaction.member.voice?.channel;
            if (!userChannel) {
                return interaction.reply({
                    embeds: [embeds.error('You are not in a voice channel.')],
                    ephemeral: true
                });
            }

            const room = getRoom(userChannel.id);

            // Los botones como 'claim', 'info' y 'activity' pueden ser usados por cualquiera
            const bypassOwnerCheck = ['vm_claim', 'vm_info', 'vm_activity'];

            if (!room && !bypassOwnerCheck.includes(interaction.customId)) {
                return interaction.reply({
                    embeds: [embeds.error('This is not a VoiceMaster channel.')],
                    ephemeral: true
                });
            }

            if (room && room.owner_id !== interaction.member.id && !bypassOwnerCheck.includes(interaction.customId)) {
                return interaction.reply({
                    embeds: [embeds.error('You are not the owner of this channel.')],
                    ephemeral: true
                });
            }

            try {
                await handler.execute(interaction, userChannel, room);
            } catch (err) {
                console.error(err);
                return interaction.reply({
                    embeds: [embeds.error('Error handling button interaction.')],
                    ephemeral: true
                });
            }
        }

        // Modal submit
        if (interaction.isModalSubmit()) {
            // Counting booster answer
            if (interaction.customId.startsWith('booster_answer:')) {
                const boosterId = interaction.customId.slice('booster_answer:'.length);
                const guildId = interaction.guildId;
                const active = getActiveBooster(guildId);
                if (!active || active.id !== boosterId) {
                    return interaction.reply({
                        content: 'someone got there first.',
                        ephemeral: true,
                    });
                }

                const raw = (interaction.fields.getTextInputValue('booster_answer_input') || '').trim();
                const guess = parseInt(raw, 10);
                const isNumber = !isNaN(guess) && raw === guess.toString();
                const correct = isNumber && guess === active.answer;

                const channel = active.channel_id
                    ? await interaction.client.channels.fetch(active.channel_id).catch(() => null)
                    : interaction.channel;
                const originalMessage = (channel && active.message_id)
                    ? await channel.messages.fetch(active.message_id).catch(() => null)
                    : null;

                if (correct) {
                    const counting = getCountingConfig(guildId);
                    const fromCount = counting.current_number;
                    const toCount = applyBoost(fromCount, active.type, active.value);
                    applyBoostToCount(guildId, toCount);

                    const winLine = fillTokens(pickLine(BOOSTER_WIN_LINES), {
                        user: `<@${interaction.user.id}>`,
                        expression: active.expression,
                        answer: active.answer,
                        from: fromCount,
                        to: toCount,
                        type: active.type,
                    });

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `⚡ booster resolved — \`${active.expression}\` = **${active.answer}** (${active.type}) — count jumped to **${toCount}**`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: winLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.reply({
                        content: `you got it — count is now **${toCount}**`,
                        ephemeral: true,
                    });
                } else {
                    clearActiveBooster(guildId);

                    const failLine = fillTokens(pickLine(BOOSTER_FAIL_LINES), {
                        user: `<@${interaction.user.id}>`,
                        expression: active.expression,
                        answer: active.answer,
                        guess: isNumber ? guess : (raw || '???'),
                    });

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `❌ booster busted — answer was **${active.answer}**`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: failLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.reply({
                        content: `nope. it was **${active.answer}**`,
                        ephemeral: true,
                    });
                }
            }

            // Counting drop answer
            if (interaction.customId.startsWith('drop_answer:')) {
                const dropId = interaction.customId.slice('drop_answer:'.length);
                const guildId = interaction.guildId;
                const active = getActiveDrop(guildId);
                if (!active || active.id !== dropId) {
                    return interaction.reply({
                        content: 'someone got there first.',
                        ephemeral: true,
                    });
                }

                const raw = (interaction.fields.getTextInputValue('drop_answer_input') || '').trim();
                const guess = parseInt(raw, 10);
                const isNumber = !isNaN(guess) && raw === guess.toString();
                const correct = isNumber && guess === active.answer;

                const channel = active.channel_id
                    ? await interaction.client.channels.fetch(active.channel_id).catch(() => null)
                    : interaction.channel;
                const originalMessage = (channel && active.message_id)
                    ? await channel.messages.fetch(active.message_id).catch(() => null)
                    : null;

                if (correct) {
                    addItem(interaction.user.id, active.item_type, 1);
                    clearActiveDrop(guildId);

                    const winLine = fillTokens(pickLine(DROP_WIN_LINES), {
                        user: `<@${interaction.user.id}>`,
                        expression: active.expression,
                        answer: active.answer,
                        emoji: active.emoji,
                        label: active.label,
                    });

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `🎁 ${active.emoji} **${active.label}** claimed by <@${interaction.user.id}>`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: winLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.reply({
                        content: `🎁 you got a ${active.emoji} **${active.label}**`,
                        ephemeral: true,
                    });
                } else {
                    clearActiveDrop(guildId);

                    const failLine = fillTokens(pickLine(DROP_FAIL_LINES), {
                        user: `<@${interaction.user.id}>`,
                        expression: active.expression,
                        answer: active.answer,
                        guess: isNumber ? guess : (raw || '???'),
                        emoji: active.emoji,
                        label: active.label,
                    });

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `🎁❌ the ${active.emoji} **${active.label}** vanishes — answer was **${active.answer}**`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: failLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.reply({
                        content: `nope. it was **${active.answer}**`,
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId === 'colors_modal_solid' || interaction.customId === 'colors_modal_gradient') {
                const isGradient = interaction.customId === 'colors_modal_gradient';

                const primary = parseHexColor(
                    interaction.fields.getTextInputValue(isGradient ? 'colors_hex_primary' : 'colors_hex')
                );
                const secondary = isGradient
                    ? parseHexColor(interaction.fields.getTextInputValue('colors_hex_secondary'))
                    : null;

                if (primary === null || (isGradient && secondary === null)) {
                    return interaction.reply({
                        embeds: [embeds.error('one of those hex codes is invalid. use a format like `#ff66cc` or `f6c`.')],
                        ephemeral: true
                    });
                }

                const customName = (interaction.fields.getTextInputValue('colors_name') || '').trim() || null;
                const iconRaw = (interaction.fields.getTextInputValue('colors_icon') || '').trim();
                const iconUrl = iconRaw || null;

                if (iconUrl && !isValidIconUrl(iconUrl)) {
                    return interaction.reply({
                        embeds: [embeds.error('that icon URL doesn\'t look right. needs to be a direct http(s) link to a png/jpg.')],
                        ephemeral: true
                    });
                }

                await interaction.deferReply({ ephemeral: true });

                try {
                    const { gradientApplied, iconApplied } = await applyPersonalColor(interaction, {
                        primaryColor: primary,
                        secondaryColor: secondary,
                        customName,
                        iconUrl
                    });

                    const hexA = primary.toString(16).padStart(6, '0');
                    const hexB = secondary !== null ? secondary.toString(16).padStart(6, '0') : null;

                    const notes = [];
                    if (isGradient && !gradientApplied) {
                        notes.push('gradient needs **Server Boost lvl 2** — fell back to solid for now');
                    }
                    if (iconUrl && !iconApplied) {
                        notes.push('couldn\'t set the icon — likely needs **Server Boost lvl 2** or the URL didn\'t load');
                    }

                    const headline = isGradient
                        ? `gradient set: **#${hexA}** → **#${hexB}**`
                        : `your color is now **#${hexA}**`;

                    const body = notes.length
                        ? `${headline}.\n\n${notes.map(n => `• ${n}`).join('\n')}`
                        : `${headline}. looking fresh ${interaction.member}`;

                    return interaction.editReply({
                        embeds: [(notes.length ? embeds.error : embeds.success)(body)]
                    });
                } catch (err) {
                    if (err?.message === 'gradient_unsupported') {
                        console.error('[Colors] gradient unsupported:', err.cause?.message || err.cause);
                        return interaction.editReply({
                            embeds: [embeds.error('this server can\'t use gradient roles yet — needs **Server Boost lvl 2**.')]
                        });
                    }
                    console.error('[Colors] failed to apply personal color:', err);
                    return interaction.editReply({
                        embeds: [embeds.error('couldn\'t set that. make sure i have **Manage Roles** and my role is high enough in the list.')]
                    });
                }
            }
        }

        // Select menu (ej: disconnect y activity)
        if (interaction.isStringSelectMenu()) {
            const userChannel = interaction.member.voice?.channel;
            if (!userChannel) {
                return interaction.reply({
                    embeds: [embeds.error('You are not in a voice channel.')],
                    ephemeral: true
                });
            }

            const room = getRoom(userChannel.id);
            const selected = interaction.values;

            if (interaction.customId === 'vm_disconnect_select') {
                const toKick = selected.filter(id => userChannel.members.has(id));
                for (const id of toKick) {
                    const member = userChannel.members.get(id);
                    if (member) await member.voice.disconnect().catch(() => {});
                }

                return interaction.reply({
                    embeds: [embeds.success(`🪝 Disconnected ${toKick.length} member(s) from your channel.`)],
                    ephemeral: true
                });
            }

            if (interaction.customId === 'vm_activity_select') {
                return interaction.reply({
                    embeds: [
                        embeds.warn(
                            `⚠️ <@${interaction.user.id}>: You can now start 🚀 **activities** in your app!\nThis **functionality** via interface buttons has been removed.`
                        )
                    ],
                    ephemeral: true
                });
            }
        }
    });
};
