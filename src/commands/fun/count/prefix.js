const { PermissionFlagsBits } = require('discord.js');
const { setCountingChannel } = require('../../../utils/storage');

module.exports = {
    name: 'count',
    aliases: [],
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args) {
        if (!args[0] || args[0].toLowerCase() !== 'setup') {
            return message.reply({
                embeds: [{
                    color: 0xa82d43,
                    description: '❌ Uso: `!count setup`'
                }]
            });
        }

        const channel = message.channel;

        // Set this channel as the counting channel
        setCountingChannel(message.guild.id, channel.id);

        message.reply({
            embeds: [{
                color: 0x7ab158,
                description: `✅ ¡Juego de contar activado en ${channel}!\n\n` +
                    `**Reglas:**\n` +
                    `• Cuenta desde 1, 2, 3...\n` +
                    `• Cada persona debe esperar su turno; no puedes contar dos veces seguidas.\n` +
                    `• Si alguien escribe un número incorrecto, la cuenta vuelve a 0.\n` +
                    `• ✅ = Correcto | ❌ = Incorrecto (reinicia la cuenta).`
            }]
        });
    }
};
