const {
    Collection,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const embeds = require('../constants/embeds');
const {
    getRoom,
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

function dropLabel(drop) {
    return ITEM_DEFS_BY_TYPE[drop.item_type]?.label || drop.label;
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
    async function handleInteraction(interaction) {
        if (!interaction.isCommand() && interaction.customId?.startsWith('ticket:')) return;

        // Slash command
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (err) {
                console.error('[Commands] Error al ejecutar el comando:', err?.message || err);
                if (err?.code === 10062) return;
                if (!interaction.deferred && !interaction.replied && Date.now() - interaction.createdTimestamp > 2500) return;
                const errorReply = {
                    embeds: [embeds.error('Error executing command.')],
                    flags: MessageFlags.Ephemeral
                };
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(errorReply).catch(error => console.error('[Commands] No pude informar el error:', error?.message || error));
                } else {
                    await interaction.reply(errorReply).catch(error => console.error('[Commands] No pude informar el error:', error?.message || error));
                }
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
                        content: 'Este potenciador ya se resolvió.',
                        ephemeral: true,
                    });
                }

                const stats = getUserStats(interaction.user.id);

                // Perfect aim: instant win, no modal
                if (stats.primed?.perfect_aim && (stats.items?.perfect_aim || 0) > 0) {
                    await interaction.deferReply({ ephemeral: true });
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
                            content: `🎯 Puntería perfecta: \`${active.expression}\` = **${active.answer}** (${active.type}). La cuenta subió a **${toCount}**.`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: `🎯 ${winLine}`,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.editReply({
                        content: `🎯 Usaste puntería perfecta y ganaste el potenciador. La cuenta quedó en **${toCount}**.`,
                    });
                }

                const useOracle = stats.primed?.oracle_eye && (stats.items?.oracle_eye || 0) > 0;
                if (useOracle) {
                    unprimeItem(interaction.user.id, 'oracle_eye');
                    removeItem(interaction.user.id, 'oracle_eye', 1);
                }

                const labelText = `Respuesta para ${active.expression}`;
                const modal = new ModalBuilder()
                    .setCustomId(`booster_answer:${boosterId}`)
                    .setTitle('Resuelve el potenciador');

                const input = new TextInputBuilder()
                    .setCustomId('booster_answer_input')
                    .setLabel(labelText.slice(0, 45))
                    .setPlaceholder(useOracle ? `🔮 La respuesta es ${active.answer}` : 'Tu respuesta')
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
                        content: 'Este premio ya no está disponible.',
                        ephemeral: true,
                    });
                }

                const labelText = `Resuelve ${active.expression}`;
                const modal = new ModalBuilder()
                    .setCustomId(`drop_answer:${dropId}`)
                    .setTitle(`Reclama ${dropLabel(active)}`.slice(0, 45));

                const input = new TextInputBuilder()
                    .setCustomId('drop_answer_input')
                    .setLabel(labelText.length > 45 ? labelText.slice(0, 45) : labelText)
                    .setPlaceholder('Tu respuesta')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
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
                        content: 'Alguien resolvió este potenciador primero.',
                        ephemeral: true,
                    });
                }

                await interaction.deferReply({ ephemeral: true });

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
                            content: `⚡ Potenciador resuelto: \`${active.expression}\` = **${active.answer}** (${active.type}). La cuenta subió a **${toCount}**.`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: winLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.editReply({
                        content: `¡Correcto! La cuenta ahora está en **${toCount}**.`,
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
                            content: `❌ Potenciador perdido. La respuesta era **${active.answer}**.`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: failLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.editReply({
                        content: `Incorrecto. La respuesta era **${active.answer}**.`,
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
                        content: 'Alguien reclamó este premio primero.',
                        ephemeral: true,
                    });
                }

                await interaction.deferReply({ ephemeral: true });

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
                        label: dropLabel(active),
                    });

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `🎁 ${active.emoji} **${dropLabel(active)}** reclamado por <@${interaction.user.id}>.`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: winLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.editReply({
                        content: `🎁 Ganaste ${active.emoji} **${dropLabel(active)}**.`,
                    });
                } else {
                    clearActiveDrop(guildId);

                    const failLine = fillTokens(pickLine(DROP_FAIL_LINES), {
                        user: `<@${interaction.user.id}>`,
                        expression: active.expression,
                        answer: active.answer,
                        guess: isNumber ? guess : (raw || '???'),
                        emoji: active.emoji,
                        label: dropLabel(active),
                    });

                    if (originalMessage) {
                        await originalMessage.edit({
                            content: `🎁❌ ${active.emoji} **${dropLabel(active)}** desapareció. La respuesta era **${active.answer}**.`,
                            components: [],
                        }).catch(() => {});
                        await originalMessage.reply({
                            content: failLine,
                            allowedMentions: { parse: ['users'] },
                        }).catch(() => {});
                    }

                    return interaction.editReply({
                        content: `Incorrecto. La respuesta era **${active.answer}**.`,
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
    }

    client.on('interactionCreate', interaction => {
        void handleInteraction(interaction).catch(async error => {
            console.error('[Interaction] Unexpected error:', error?.message || error);
            const response = { embeds: [embeds.error('Ocurrió un error al procesar la interacción.')] };
            if (interaction.deferred) {
                await interaction.editReply(response).catch(() => {});
            } else if (!interaction.replied) {
                await interaction.reply({ ...response, ephemeral: true }).catch(() => {});
            }
        });
    });
};
