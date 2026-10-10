const { getCountingConfig } = require('../utils/storage');

const SNARKY_LINES = [
    '{user} borró el **{n}**, pero la cuenta lo recuerda. Seguimos en **{n}**.',
    'Aunque {user} eliminó su mensaje, el **{n}** ya contó.',
    '{user} intentó desaparecer el **{n}**. La cuenta sigue en **{n}**.',
    'El **{n}** de {user} quedó registrado, aunque el mensaje ya no esté.',
    'Borrar el mensaje no reinicia la cuenta, {user}. Seguimos en **{n}**.',
    'Se fue el mensaje de {user}, pero el **{n}** se queda.'
];

function pickLine() {
    return SNARKY_LINES[Math.floor(Math.random() * SNARKY_LINES.length)];
}

module.exports = (client) => {
    client.on('messageDelete', async (message) => {
        if (message.partial) return;
        if (!message.author || message.author.bot) return;
        if (!message.guild) return;

        const countConfig = getCountingConfig(message.guild.id);
        if (countConfig.channel_id !== message.channel.id) return;

        const content = message.content?.trim();
        if (!content) return;

        const deletedNumber = parseInt(content);
        if (isNaN(deletedNumber) || content !== deletedNumber.toString()) return;

        if (deletedNumber !== countConfig.current_number) return;
        if (message.author.id !== countConfig.last_user_id) return;

        const line = pickLine()
            .replaceAll('{user}', `${message.author}`)
            .replaceAll('{n}', deletedNumber);

        await message.channel.send({ content: line }).catch(() => {});
    });
};
