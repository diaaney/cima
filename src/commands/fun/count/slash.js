const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const { setCountingChannel } = require('../../../utils/storage');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('count')
        .setDescription('Configura el juego de contar en este canal')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Activa el juego de contar aquí')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        // Set this channel as the counting channel
        setCountingChannel(interaction.guild.id, channel.id);

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Update to success state
        await interaction.editReply({
            embeds: [embeds.success(
                `¡Juego de contar activado en ${channel}!\n\n` +
                `**Reglas:**\n` +
                `• Cuenta desde 1, 2, 3...\n` +
                `• Cada persona debe esperar su turno; no puedes contar dos veces seguidas.\n` +
                `• Si alguien escribe un número incorrecto, la cuenta vuelve a 0.\n` +
                `• ✅ = Correcto | ❌ = Incorrecto (reinicia la cuenta).`
            )]
        });
    }
};
