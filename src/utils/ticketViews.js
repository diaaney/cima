const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const embeds = require('../constants/embeds');
const { TYPES } = require('../constants/tickets');

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
    '¿Por qué quieres ser staff y qué aportarías al servidor?',
    '¿Tienes experiencia moderando comunidades?',
    '¿Qué harías si dos miembros comienzan a insultarse?',
    '¿Cómo actuarías si un amigo o alguien del staff rompe las reglas?',
    '¿Qué harías si no sabes cómo resolver una situación?',
    '¿Tienes disponibilidad para atender reportes y colaborar con el equipo?',
]);

function staffApplicationModal(part) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket:staff-form-${part}`)
        .setTitle(`Postulación para Staff · ${part}/2`);
    const offset = (part - 1) * 3;
    for (let index = offset; index < offset + 3; index++) {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(`answer-${index}`)
                .setLabel(`${index + 1}. ${STAFF_QUESTIONS[index]}`.slice(0, 45))
                .setPlaceholder(STAFF_QUESTIONS[index])
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(2)
                .setMaxLength(500)
                .setRequired(true)
        ));
    }
    return modal;
}

function staffApplicationContinue() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:staff-continue')
            .setLabel('Continuar postulación (4–6)')
            .setStyle(ButtonStyle.Primary)
    )];
}

function staffApplicationEmbed(ownerId, answers) {
    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('🛡️ Postulación para Staff | UABC')
        .setDescription(
            `Respuestas de <@${ownerId}>. Queremos conocer tu criterio y tus ganas de apoyar a la comunidad.\n\n` +
            STAFF_QUESTIONS.map((question, index) =>
                `**${index + 1}. ${question}**\n${answers[index]}`
            ).join('\n\n') +
            '\n\n> Revisaremos tus respuestas y te contactaremos si avanzas en el proceso.'
        );
}

module.exports = {
    panelEmbed, panelButtons, typeMenu, welcomeEmbed, ticketButtons, closeConfirmation,
    STAFF_QUESTIONS, staffApplicationModal, staffApplicationContinue, staffApplicationEmbed,
};
