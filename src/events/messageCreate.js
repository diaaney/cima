const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    getCountingConfig,
    updateCount,
    resetCount,
    isAfk,
    removeAfk,
    getReactMessage,
    decrementReactMessage,
    getActiveBooster,
    setActiveBooster,
    getActiveDrop,
    setActiveDrop,
    getUserStats,
    addToTotalCount,
    armShield,
    findShieldSaver,
    consumeShield,
    clearSabotaged,
} = require('../utils/storage');
const embeds = require('../constants/embeds');
const { generateBooster, generateOperation } = require('../utils/boosterOps');
const { generateDrop, ITEM_DEFS_BY_TYPE } = require('../utils/itemDrops');
const { evaluateExpression, isPureInteger } = require('../utils/safeMath');
const {
    WRONG_NUMBER_LINES,
    SHIELD_SAVE_LINES,
    SABOTAGE_FUMBLE_LINES,
    pickLine,
    fillTokens,
} = require('../constants/countingLines');

const BOOSTER_CHANCE = 0.08;
const DROP_CHANCE = 0.04;

async function spawnBooster(message, userNumber, guildId) {
    const booster = generateBooster(userNumber);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`booster_claim:${booster.id}`)
            .setLabel('claim it')
            .setEmoji('🎯')
            .setStyle(ButtonStyle.Primary)
    );
    const content = `⚡ booster spawned — solve \`${booster.expression}\` and the count gets **${booster.type}**`;
    try {
        const sent = await message.channel.send({ content, components: [row] });
        booster.channel_id = sent.channelId;
        booster.message_id = sent.id;
        setActiveBooster(guildId, booster);
    } catch (err) {
        console.error('[Counting] failed to spawn booster:', err);
    }
}

async function spawnDrop(message, userNumber, guildId) {
    const op = generateOperation(userNumber + 1);
    const drop = generateDrop(op);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`drop_claim:${drop.id}`)
            .setLabel('claim it')
            .setEmoji('🎯')
            .setStyle(ButtonStyle.Success)
    );
    const content = `🎁 a ${drop.emoji} **${drop.label}** appeared — solve \`${drop.expression}\` to claim it`;
    try {
        const sent = await message.channel.send({ content, components: [row] });
        drop.channel_id = sent.channelId;
        drop.message_id = sent.id;
        setActiveDrop(guildId, drop);
    } catch (err) {
        console.error('[Counting] failed to spawn drop:', err);
    }
}

async function rollSpawn(message, userNumber, guildId) {
    if (getActiveBooster(guildId) || getActiveDrop(guildId)) return;
    const r = Math.random();
    if (r < BOOSTER_CHANCE) {
        await spawnBooster(message, userNumber, guildId);
    } else if (r < BOOSTER_CHANCE + DROP_CHANCE) {
        await spawnDrop(message, userNumber, guildId);
    }
}

async function handleShieldSave(message, fumbler, fumbledValue, expectedNumber, currentNumber, client) {
    const saver = findShieldSaver(currentNumber);
    if (!saver) return false;
    consumeShield(saver);
    let saverMention = `<@${saver}>`;
    try {
        const saverUser = await client.users.fetch(saver);
        if (saverUser) saverMention = `<@${saverUser.id}>`;
    } catch {}
    await message.react('🛡').catch(() => {});
    const line = fillTokens(pickLine(SHIELD_SAVE_LINES), {
        saver: saverMention,
        fumbler: `${fumbler}`,
        got: fumbledValue,
        expected: expectedNumber,
        n: currentNumber,
    });
    await message.reply({
        content: line,
        allowedMentions: { repliedUser: false, parse: ['users'] },
    }).catch(() => {});
    return true;
}

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        // --- 🔹 AFK SYSTEM ---
        const authorAfk = isAfk(message.author.id);
        if (authorAfk) {
            removeAfk(message.author.id);
            const duration = Math.floor((Date.now() - authorAfk.since) / 1000);
            const minutes = Math.floor(duration / 60);
            const timeStr = minutes > 0 ? `${minutes}m` : `${duration}s`;

            await message.reply({
                embeds: [embeds.success(`welcome back! you were afk for **${timeStr}**`)]
            }).catch(() => {});
        }

        if (message.mentions.users.size > 0) {
            for (const [userId, user] of message.mentions.users) {
                const afkData = isAfk(userId);
                if (afkData) {
                    const duration = Math.floor((Date.now() - afkData.since) / 1000);
                    const minutes = Math.floor(duration / 60);
                    const timeStr = minutes > 0 ? `${minutes}m ago` : `${duration}s ago`;

                    await message.reply({
                        embeds: [embeds.success(`yo ${user.username} is afk rn - **${afkData.reason}** (${timeStr})`)]
                    }).catch(() => {});
                    break;
                }
            }
        }

        // --- 🔹 REACT MESSAGES ---
        const reactData = getReactMessage(message.author.id);
        if (reactData) {
            await message.react(reactData.emoji).catch(() => {});
            decrementReactMessage(message.author.id);
        }

        // --- 🔹 COUNTING GAME ---
        const guildId = message.guild?.id;
        const countConfig = guildId ? getCountingConfig(guildId) : null;
        if (countConfig && countConfig.channel_id === message.channel.id) {
            const raw = message.content.trim();
            const senderStats = getUserStats(message.author.id);
            const isSabotaged = senderStats.sabotaged === true;

            // Determine if message is a count attempt
            let userNumber = null;
            let isMathSubmission = false;

            if (isPureInteger(raw)) {
                userNumber = parseInt(raw, 10);
            } else if (isSabotaged) {
                const evaluated = evaluateExpression(raw);
                if (evaluated !== null) {
                    userNumber = evaluated;
                    isMathSubmission = true;
                }
            }

            if (userNumber === null) return;

            const expectedNumber = countConfig.current_number + 1;
            const isSameUser = countConfig.last_user_id === message.author.id;

            if (isSameUser && countConfig.current_number > 0) {
                return;
            }

            // Sabotage gate: sabotaged user submitted a plain integer (not math) → punish
            if (isSabotaged && !isMathSubmission) {
                clearSabotaged(message.author.id);

                const saved = await handleShieldSave(
                    message, message.author, userNumber, expectedNumber, countConfig.current_number, client
                );
                if (saved) return;

                await message.react('❌').catch(() => {});
                resetCount(guildId);

                const half = Math.max(1, Math.floor(expectedNumber / 2));
                const otherHalf = expectedNumber - half;
                const line = fillTokens(pickLine(SABOTAGE_FUMBLE_LINES), {
                    user: `${message.author}`,
                    got: userNumber,
                    expected: expectedNumber,
                    example: `${half}+${otherHalf}`,
                });
                await message.reply({
                    content: line,
                    allowedMentions: { repliedUser: false, parse: ['users'] },
                }).catch(() => {});
                return;
            }

            if (userNumber === expectedNumber) {
                await message.react('✅').catch(() => {});
                if (isSabotaged) clearSabotaged(message.author.id);
                if (isMathSubmission) await message.react('🧮').catch(() => {});
                updateCount(guildId, userNumber, message.author.id);
                addToTotalCount(message.author.id, userNumber);
                armShield(message.author.id, userNumber);

                await rollSpawn(message, userNumber, guildId);
            } else {
                if (isSabotaged) clearSabotaged(message.author.id);

                const saved = await handleShieldSave(
                    message, message.author, userNumber, expectedNumber, countConfig.current_number, client
                );
                if (saved) return;

                await message.react('❌').catch(() => {});
                const reached = countConfig.current_number;
                resetCount(guildId);

                const line = fillTokens(pickLine(WRONG_NUMBER_LINES), {
                    user: `${message.author}`,
                    expected: expectedNumber,
                    got: userNumber,
                    reached: reached,
                });

                await message.reply({
                    content: line,
                    allowedMentions: { repliedUser: false, parse: ['users'] },
                }).catch(() => {});
            }
            return;
        }

        // --- 🔹 COMANDOS PREFIX ---
        const prefix = '!';

        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();

        const command = client.prefixCommands.get(cmd);
        if (!command) return;

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            await message.reply('❌ Error executing command');
        }
    });
};
