const { getCountingConfig } = require('../utils/storage');

const SNARKY_LINES = [
    'lmao {user} deleted **{n}** like nobody saw it. the count stays at **{n}** 💀',
    'nice try {user}, your sneaky delete won\'t save you. it\'s still **{n}**',
    'oh {user} thought we wouldn\'t notice? **{n}** counted, deal with it',
    '{user} really pulled a vanishing act on **{n}**, but the count remembers',
    'sit down {user}, **{n}** is locked in whether you like it or not',
    'caught {user} red-handed trying to nuke **{n}**. count: **{n}**',
    'you can run {user}, but **{n}** runs with you forever',
    '{user} out here speedrunning regret. **{n}** is staying',
    'imagine deleting **{n}** like the bot doesn\'t have eyes. silly {user}',
    'cute attempt {user}. the count remains at **{n}**',
    'cope harder {user}, **{n}** isn\'t going anywhere',
    '{user} thought ctrl+z would work in real life. it\'s still **{n}**',
    'sneaky little gremlin {user} tried to undo **{n}**. denied.',
    '{user} deleting their count is the most {user} thing ever. it\'s **{n}**',
    'plot twist for {user}: bots have memory. **{n}** stays',
    '{user} just commited self-sabotage but the count says **{n}**',
    'shameful behavior from {user}. **{n}** is now permanent record',
    'rookie move {user}. the count is **{n}** and we all know it',
    '{user} folded under pressure and tried to delete **{n}**. embarrassing.',
    'don\'t be like {user} kids. count stays at **{n}**'
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
