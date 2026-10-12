const {
    ChannelType, Events, MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const { CATEGORY_ID, STAFF_ROLE_IDS, ADMIN_ROLE_ID, TYPES } = require('../constants/tickets');
const store = require('../utils/ticketStore');
const {
    typeMenu, welcomeEmbed, ticketButtons, closeConfirmation,
    staffApplicationModal, staffApplicationEmbed,
} = require('../utils/ticketViews');

const openingUsers = new Set();
const closingChannels = new Set();
const ephemeral = MessageFlags.Ephemeral;

function isAdmin(member) {
    return member?.permissions?.has(PermissionFlagsBits.Administrator) || false;
}

function isStaff(member) {
    return isAdmin(member) || STAFF_ROLE_IDS.some(id => member?.roles.cache.has(id));
}

function channelName(type, member, number) {
    const username = (member.displayName || member.user.username)
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 20) || `usuario-${member.id.slice(-4)}`;
    return `${type}-${username}-${String(number).padStart(3, '0')}`;
}

function initialOverwrites(guildId, ownerId, unverifiedRoleId) {
    const view = PermissionFlagsBits.ViewChannel;
    const send = PermissionFlagsBits.SendMessages;
    const history = PermissionFlagsBits.ReadMessageHistory;
    return [
        { id: guildId, deny: [view] },
        { id: unverifiedRoleId, deny: [view] },
        { id: ownerId, allow: [view, send, history] },
        ...STAFF_ROLE_IDS.map(id => ({ id, allow: [view, send, history] })),
        { id: ADMIN_ROLE_ID, allow: [view, send, history] },
    ];
}

async function openTicket(interaction, type = interaction.values?.[0], answers = null) {
    if (!TYPES[type]) return interaction.reply({ content: 'Tipo de ticket inválido.', flags: ephemeral });
    if (interaction.guildId !== process.env.GUILD_ID?.trim()) {
        return interaction.reply({ content: 'Este panel solo funciona en Nexo UABC.', flags: ephemeral });
    }
    if (interaction.member.roles.cache.has(process.env.UNVERIFIED_ROLE_ID?.trim())) {
        return interaction.reply({ content: 'Verifica tu correo UABC antes de abrir un ticket.', flags: ephemeral });
    }
    if (openingUsers.has(interaction.user.id)) {
        return interaction.reply({ content: 'Ya estoy abriendo tu ticket. Espera un momento.', flags: ephemeral });
    }

    openingUsers.add(interaction.user.id);
    try {
        await interaction.deferReply({ flags: ephemeral });
        const existing = store.findOpenByOwner(interaction.user.id);
        if (existing) {
            const channel = await interaction.guild.channels.fetch(existing[0]).catch(() => null);
            if (channel) return interaction.editReply({ content: `Ya tienes un ticket abierto: ${channel}.` });
            store.close(existing[0], 'system');
        }

        const category = await interaction.guild.channels.fetch(CATEGORY_ID).catch(() => null);
        if (category?.type !== ChannelType.GuildCategory) {
            return interaction.editReply({ content: 'La categoría de soporte no está disponible. Avisa a un administrador.' });
        }
        if (category.children.cache.size >= 50) {
            return interaction.editReply({ content: 'La categoría de soporte está llena. Avisa a un administrador.' });
        }

        const member = type === 'staff'
            ? await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member)
            : interaction.member;
        const number = store.reserveNumber();
        const ticket = { ownerId: interaction.user.id, type, number, createdAt: new Date().toISOString() };
        const channel = await interaction.guild.channels.create({
            name: channelName(type, member, number),
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: `Ticket #${number} · ${TYPES[type].label} · usuario ${interaction.user.id}`,
            permissionOverwrites: initialOverwrites(
                interaction.guild.id, interaction.user.id, process.env.UNVERIFIED_ROLE_ID?.trim()
            ),
            reason: `Ticket #${number} abierto por ${interaction.user.id}`,
        });

        store.add(channel.id, ticket);
        try {
            await channel.send({
                content: `<@${interaction.user.id}> ${STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(' ')}`,
                embeds: [welcomeEmbed(ticket)],
                components: ticketButtons(ticket),
                allowedMentions: { users: [interaction.user.id], roles: STAFF_ROLE_IDS },
            });
            if (type === 'staff') {
                await channel.send({
                    embeds: [staffApplicationEmbed(member, interaction.guild, answers)],
                    allowedMentions: { parse: [] },
                });
            }
        } catch (error) {
            await channel.delete('Could not publish ticket welcome message').catch(() => {});
            store.close(channel.id, 'system');
            throw error;
        }
        await interaction.editReply({ content: `Tu ticket está listo: ${channel}` });
    } finally {
        openingUsers.delete(interaction.user.id);
    }
}

function readAnswers(interaction) {
    return Array.from({ length: 3 }, (_, index) =>
        interaction.fields.getTextInputValue(`answer-${index}`).trim()
    );
}

async function claimTicket(interaction) {
    const ticket = store.get(interaction.channelId);
    if (!ticket || ticket.status !== 'open' || interaction.channel.parentId !== CATEGORY_ID) {
        return interaction.reply({ content: 'Este ticket ya no está activo.', flags: ephemeral });
    }
    if (!isStaff(interaction.member)) {
        return interaction.reply({ content: 'Solo el staff puede reclamar tickets.', flags: ephemeral });
    }
    await interaction.deferReply({ flags: ephemeral });
    const claimed = store.claim(interaction.channelId, interaction.user.id);
    if (!claimed) return interaction.editReply({ content: 'Este ticket ya fue reclamado por otra persona.' });

    try {
        for (const roleId of STAFF_ROLE_IDS) {
            await interaction.channel.permissionOverwrites.edit(roleId, {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages: false,
                SendMessagesInThreads: false,
                CreatePublicThreads: false,
                CreatePrivateThreads: false,
            }, { reason: `Ticket #${ticket.number} reclamado por ${interaction.user.id}` });
        }
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            ReadMessageHistory: true,
            SendMessages: true,
            SendMessagesInThreads: true,
        }, { reason: `Staff asignado al ticket #${ticket.number}` });
    } catch (error) {
        store.undoClaim(interaction.channelId, interaction.user.id);
        for (const roleId of STAFF_ROLE_IDS) {
            await interaction.channel.permissionOverwrites.edit(roleId, {
                SendMessages: true,
                SendMessagesInThreads: true,
                CreatePublicThreads: null,
                CreatePrivateThreads: null,
            }).catch(() => {});
        }
        throw error;
    }

    await interaction.message.edit({
        embeds: [welcomeEmbed(claimed)],
        components: ticketButtons(claimed),
        allowedMentions: { parse: [] },
    }).catch(error => console.warn('[Tickets] Could not refresh claim message:', error));
    await interaction.editReply({ content: `Reclamaste el ticket #${ticket.number}.` });
}

function canClose(member, userId, ticket) {
    return userId === ticket.ownerId || isAdmin(member) ||
        userId === ticket.claimedBy || (!ticket.claimedBy && isStaff(member));
}

async function closeTicket(interaction) {
    const ticket = store.get(interaction.channelId);
    if (!ticket || ticket.status !== 'open' || interaction.channel.parentId !== CATEGORY_ID) {
        return interaction.reply({ content: 'Este ticket ya no está activo.', flags: ephemeral });
    }
    if (!canClose(interaction.member, interaction.user.id, ticket)) {
        return interaction.reply({ content: 'Solo quien abrió el ticket, el staff asignado o un admin puede cerrarlo.', flags: ephemeral });
    }
    if (interaction.customId === 'ticket:close') {
        return interaction.reply({
            content: `¿Cerrar el ticket #${ticket.number}? El canal se eliminará.`,
            components: closeConfirmation(),
            flags: ephemeral,
        });
    }
    if (closingChannels.has(interaction.channelId)) {
        return interaction.reply({ content: 'Este ticket ya se está cerrando.', flags: ephemeral });
    }
    closingChannels.add(interaction.channelId);
    try {
        await interaction.update({ content: `Cerrando el ticket #${ticket.number}…`, components: [] });
        await interaction.channel.delete(`Ticket #${ticket.number} cerrado por ${interaction.user.id}`);
        store.close(interaction.channelId, interaction.user.id);
    } finally {
        closingChannels.delete(interaction.channelId);
    }
}

async function inviteMentionedStaff(message) {
    if (message.author.bot || message.channel.parentId !== CATEGORY_ID) return;
    const ticket = store.get(message.channel.id);
    if (!ticket || ticket.status !== 'open' || !ticket.claimedBy) return;
    const mayInvite = message.author.id === ticket.ownerId || message.author.id === ticket.claimedBy ||
        ticket.invitedStaff.includes(message.author.id) || isAdmin(message.member);
    if (!mayInvite) return;

    for (const user of message.mentions.users.values()) {
        if (user.id === ticket.claimedBy || ticket.invitedStaff.includes(user.id)) continue;
        const member = await message.guild.members.fetch(user.id).catch(() => null);
        if (!member || !isStaff(member) || isAdmin(member)) continue;
        await message.channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
            ReadMessageHistory: true,
            SendMessages: true,
            SendMessagesInThreads: true,
        }, { reason: `Invitado al ticket #${ticket.number} mediante mención` });
        store.invite(message.channel.id, member.id);
        await message.channel.send({
            content: `<@${member.id}> ahora puede responder en este ticket.`,
            allowedMentions: { users: [member.id] },
        });
    }
}

module.exports = client => {
    client.on(Events.InteractionCreate, interaction => {
        if (!interaction.customId?.startsWith('ticket:')) return;
        const run = async () => {
            if (interaction.customId === 'ticket:open' && interaction.isButton()) {
                if (interaction.member?.roles.cache.has(process.env.UNVERIFIED_ROLE_ID?.trim())) {
                    return interaction.reply({ content: 'Verifica tu correo UABC antes de abrir un ticket.', flags: ephemeral });
                }
                return interaction.reply({ content: '¿En qué podemos ayudarte?', components: typeMenu(), flags: ephemeral });
            }
            if (interaction.customId === 'ticket:type' && interaction.isStringSelectMenu()) {
                if (interaction.values[0] === 'staff') return interaction.showModal(staffApplicationModal());
                return openTicket(interaction);
            }
            if (interaction.customId === 'ticket:staff-form' && interaction.isModalSubmit()) {
                return openTicket(interaction, 'staff', readAnswers(interaction));
            }
            if (interaction.customId === 'ticket:claim' && interaction.isButton()) return claimTicket(interaction);
            if (interaction.customId === 'ticket:close-cancel' && interaction.isButton()) {
                return interaction.update({ content: 'Cierre cancelado.', components: [] });
            }
            if (['ticket:close', 'ticket:close-confirm'].includes(interaction.customId) && interaction.isButton()) {
                return closeTicket(interaction);
            }
        };
        void run().catch(async error => {
            console.error('[Tickets] Interaction failed:', error);
            const response = { content: 'No pude completar esta acción. Inténtalo de nuevo o avisa a un administrador.' };
            if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
            else await interaction.reply({ ...response, flags: ephemeral }).catch(() => {});
        });
    });
    client.on(Events.MessageCreate, message => {
        void inviteMentionedStaff(message).catch(error => console.error('[Tickets] Staff mention failed:', error));
    });
};

module.exports.channelName = channelName;
module.exports.initialOverwrites = initialOverwrites;
module.exports.canClose = canClose;
