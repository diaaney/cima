const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder,
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

module.exports = { panelEmbed, panelButtons, typeMenu, welcomeEmbed, ticketButtons, closeConfirmation };
