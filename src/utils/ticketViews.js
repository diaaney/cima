const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const embeds = require('../constants/embeds');
const { TYPES } = require('../constants/tickets');
const { highestMemberRank } = require('./levelSystem');

function panelEmbed() {
    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('🎫 Centro de soporte')
        .setDescription(
            'Elige el motivo de tu consulta y Cima abrirá un canal privado para ti y el equipo de moderación.\n\n' +
            Object.values(TYPES).map(type => `${type.emoji} **${type.label}** · ${type.description}`).join('\n') +
            '\n\nPuedes tener **un ticket abierto** a la vez.'
        );
}

function panelButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:open').setLabel('Abrir ticket')
            .setEmoji('🎫').setStyle(ButtonStyle.Primary)
    )];
}

function typeMenu() {
    return [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket:type')
            .setPlaceholder('Elige el tipo de ticket')
            .addOptions(Object.entries(TYPES).map(([value, type]) => ({
                label: type.label,
                description: type.description,
                emoji: type.emoji,
                value,
            })))
    )];
}

function welcomeEmbed(ticket) {
    const type = TYPES[ticket.type];
    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle(`${type.emoji} ${type.label} · Ticket #${ticket.number}`)
        .setDescription(
            `Hola <@${ticket.ownerId}>. Cuéntanos qué necesitas y comparte los detalles que ayuden a resolverlo.\n\n` +
            `**Estado:** ${ticket.claimedBy ? `Asignado a <@${ticket.claimedBy}>` : 'Esperando a un miembro del staff'}\n` +
            (ticket.claimedBy
                ? 'Solo la persona asignada y los admins responden. Si necesitas a otro miembro del staff, menciónalo aquí.'
                : 'Un miembro del staff puede pulsar **Reclamar ticket** para atenderte.')
        )
        .setFooter({ text: 'Usa el botón de cerrar cuando termine la conversación.' });
}

function ticketButtons(ticket) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:claim')
            .setLabel(ticket.claimedBy ? 'Ticket reclamado' : 'Reclamar ticket')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(Boolean(ticket.claimedBy)),
        new ButtonBuilder().setCustomId('ticket:close')
            .setLabel('Cerrar ticket')
            .setStyle(ButtonStyle.Danger)
    )];
}

function closeConfirmation() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:close-confirm')
            .setLabel('Sí, cerrar ticket')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket:close-cancel')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
    )];
}

const STAFF_QUESTIONS = Object.freeze([
    '¿Por qué quieres ser staff y qué aportarías?',
    '¿Qué harías si dos miembros se insultan?',
    '¿Qué harías si un amigo o staff rompe las reglas?',
]);

const STAFF_QUESTION_LABELS = Object.freeze([
    '¿Por qué quieres ser staff?',
    '¿Dos miembros se insultan?',
    '¿Un amigo rompe las reglas?',
]);

function staffApplicationModal() {
    const modal = new ModalBuilder()
        .setCustomId('ticket:staff-form')
        .setTitle('Postulación para Staff');
    for (let index = 0; index < STAFF_QUESTIONS.length; index++) {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(`answer-${index}`)
                .setLabel(`${index + 1}. ${STAFF_QUESTION_LABELS[index]}`)
                .setPlaceholder(STAFF_QUESTIONS[index])
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(2)
                .setMaxLength(500)
                .setRequired(true)
        ));
    }
    return modal;
}

function staffApplicationEmbed(member, guild, answers) {
    const rank = highestMemberRank(member);
    const icon = rank && guild.emojis.cache.find(emoji => emoji.name === rank.emoji);
    const joinedAt = member.joinedTimestamp
        ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
        : 'Fecha no disponible';
    const accountCreatedAt = member.user.createdTimestamp
        ? `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`
        : 'Fecha no disponible';
    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('🛡️ Postulación para Staff | UABC')
        .setDescription(
            `**Solicitante:** <@${member.id}>\n` +
            `**Ingreso al servidor:** ${joinedAt}\n` +
            `**Cuenta creada:** ${accountCreatedAt}\n` +
            `**Rango:** ${icon ? `${icon} ` : ''}${rank ? `<@&${rank.id}>` : 'Sin rango de nivel'}\n\n` +
            STAFF_QUESTIONS.map((question, index) =>
                `**${index + 1}. ${question}**\n${answers[index]}`
            ).join('\n\n') +
            '\n\n> Revisaremos tus respuestas y te contactaremos si avanzas en el proceso.'
        )
        .setThumbnail(member.user.displayAvatarURL());
}

module.exports = {
    panelEmbed, panelButtons, typeMenu, welcomeEmbed, ticketButtons, closeConfirmation,
    STAFF_QUESTIONS, staffApplicationModal, staffApplicationEmbed,
};
