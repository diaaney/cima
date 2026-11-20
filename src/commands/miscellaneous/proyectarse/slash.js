const {
    EmbedBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const GENERAL_CHANNEL_ID = '1512976564541849760';
const MODAL_ID = 'projection:submit';
const MESSAGE_ID = 'projection:message';
const VISIBILITY_ID = 'projection:visibility';

function isUnverified(interaction) {
    const roleId = process.env.UNVERIFIED_ROLE_ID?.trim();
    const roles = interaction.member?.roles;
    return Boolean(roleId && (roles?.cache?.has(roleId) ||
        (Array.isArray(roles) && roles.includes(roleId))));
}

function projectionModal() {
    return new ModalBuilder()
        .setCustomId(MODAL_ID)
        .setTitle('Proyectarse en la comunidad')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Tu mensaje')
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(MESSAGE_ID)
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Escribe lo que quieres compartir...')
                    .setMinLength(1)
                    .setMaxLength(2000)
                    .setRequired(true)),
            new LabelBuilder()
                .setLabel('¿Cómo quieres publicarlo?')
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(VISIBILITY_ID)
                    .setPlaceholder('Elige una opción')
                    .setRequired(true)
                    .addOptions(
                        { label: 'Anónimo', value: 'anonymous', description: 'Tu identidad no aparecerá en el embed.' },
                        { label: 'Público', value: 'public', description: 'Aparecerán tu nombre y foto.' },
                    )),
        );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('proyectarse')
        .setDescription('Comparte un mensaje en general, público o anónimo'),

    async execute(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== process.env.GUILD_ID?.trim()) {
            return interaction.reply({ content: 'Este comando solo funciona en el servidor.', flags: MessageFlags.Ephemeral });
        }
        if (isUnverified(interaction)) {
            return interaction.reply({ content: 'Primero debes verificarte para publicar en general.', flags: MessageFlags.Ephemeral });
        }
        await interaction.showModal(projectionModal());
    },

    async handleModal(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== process.env.GUILD_ID?.trim()) {
            return interaction.reply({ content: 'Este formulario solo funciona en el servidor.', flags: MessageFlags.Ephemeral });
        }
        if (isUnverified(interaction)) {
            return interaction.reply({ content: 'Primero debes verificarte para publicar en general.', flags: MessageFlags.Ephemeral });
        }

        const message = interaction.fields.getTextInputValue(MESSAGE_ID).trim();
        const visibility = interaction.fields.getStringSelectValues(VISIBILITY_ID)[0];
        if (!message || !['anonymous', 'public'].includes(visibility)) {
            return interaction.reply({ content: 'Completa el mensaje y elige cómo publicarlo.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const channel = await interaction.guild.channels.fetch(GENERAL_CHANNEL_ID);
            if (!channel?.isTextBased() || typeof channel.send !== 'function') {
                throw new Error('General is not a text channel');
            }
            const embed = new EmbedBuilder()
                .setTitle(visibility === 'anonymous' ? '💭 Proyección anónima' : '💭 Proyección')
                .setDescription(message);
            if (visibility === 'public') {
                embed.setAuthor({
                    name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
                    iconURL: interaction.member?.displayAvatarURL?.() || interaction.user.displayAvatarURL(),
                });
            }
            await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
            await interaction.deleteReply().catch(error => {
                console.warn('[Projection] Could not remove private confirmation:', error);
            });
        } catch (error) {
            console.error('[Projection] Could not publish message:', error);
            await interaction.editReply({ content: 'No pude publicar tu mensaje en general. Inténtalo de nuevo.' });
        }
    },
};

module.exports.projectionModal = projectionModal;
