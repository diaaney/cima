const { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { STAFF_ROLE_IDS } = require('../../../constants/tickets');
const activity = require('../../../utils/staffActivity');

function roleIcon(guild, member, savedRoleId) {
    const role = STAFF_ROLE_IDS.map(id => guild.roles.cache.get(id))
        .filter(Boolean).filter(candidate => candidate.id === savedRoleId || member.roles.cache.has(candidate.id))
        .sort((a, b) => b.position - a.position)[0];
    if (!role) return '🛡️';
    if (role.unicodeEmoji) return role.unicodeEmoji;
    const name = role.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const emoji = guild.emojis.cache.find(item => item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === name);
    return emoji ? `${emoji}` : role.id === STAFF_ROLE_IDS[0] ? '🛡️' : '🔨';
}

function line(guild, member, start, goal, current, tracked, review) {
    const { weekly, total } = activity.metrics(guild.id, member.id, start);
    const score = activity.points(weekly);
    const status = review?.status === 'removed' ? '❌ no cumplió · rango retirado' :
        review?.status === 'exempt' ? '⭐ exento' :
            review?.status === 'ok' ? '✅ cumplió' :
                review?.status === 'error' ? '⚠️ error al retirar' :
        (!current && (tracked?.eligible_week > start || start < activity.settings(guild.id).started_week + activity.WEEK_MS)) ? '🕒 sin evaluación' :
        member.permissions.has(PermissionFlagsBits.Administrator) ? '⭐ exento' :
            score >= goal ? '✅ cumplió' : current ? '⏳ en curso' : '❌ no cumplió';
    return `${roleIcon(guild, member, review?.role_id)} **${member.displayName.replace(/[*_`~|]/g, '')}** · <@${member.id}> · ${status}\n` +
        `Semana: **${score}/${goal}** pts · ${breakdown(weekly)}\n` +
        `Total: **${activity.points(total)}** pts · ${breakdown(total)}`;
}

function breakdown(value) {
    return `${value.replies} respuestas · ${value.welcomes} bienvenidas · ` +
        `${value.suggestions} sugerencias · ${value.messages} mensajes · ` +
        `${value.claims} tickets, ${value.closes} cierres`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staffactividad')
        .setDescription('Consulta y configura la actividad semanal de Staff y Moderator')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('ver').setDescription('Muestra la actividad del equipo')
            .addStringOption(option => option.setName('semana').setDescription('Semana a consultar')
                .addChoices({ name: 'Actual', value: 'actual' }, { name: 'Anterior', value: 'anterior' })))
        .addSubcommand(sub => sub.setName('meta').setDescription('Ajusta los puntos semanales requeridos')
            .addIntegerOption(option => option.setName('puntos').setDescription('Entre 1 y 500 puntos')
                .setRequired(true).setMinValue(1).setMaxValue(500)))
        .addSubcommand(sub => sub.setName('foro').setDescription('Elige el foro de sugerencias')
            .addChannelOption(option => option.setName('canal').setDescription('Foro de sugerencias')
                .addChannelTypes(ChannelType.GuildForum).setRequired(true))),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Solo un administrador puede ver la actividad del equipo.', flags: MessageFlags.Ephemeral });
        }
        if (interaction.options.getSubcommand() === 'meta') {
            const goal = interaction.options.getInteger('puntos', true);
            activity.setGoal(interaction.guildId, goal);
            return interaction.reply({ content: `Meta semanal actualizada a **${goal} puntos**.`, flags: MessageFlags.Ephemeral });
        }
        if (interaction.options.getSubcommand() === 'foro') {
            const channel = interaction.options.getChannel('canal', true);
            activity.setSuggestionsForum(interaction.guildId, channel.id);
            return interaction.reply({ content: `Contaré las respuestas en ${channel} como actividad de sugerencias.`, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild;
        const config = activity.settings(guild.id);
        const current = interaction.options.getString('semana') !== 'anterior';
        const start = activity.weekStart() - (current ? 0 : activity.WEEK_MS);
        const members = await guild.members.fetch();
        const staff = [...members.values()].filter(member => !member.user.bot &&
            STAFF_ROLE_IDS.some(id => member.roles.cache.has(id)));
        for (const member of staff) activity.trackMember(member);
        const reviews = new Map(activity.reviews(guild.id, start).map(row => [row.user_id, row]));
        const tracked = new Map(activity.trackedMembers(guild.id).map(row => [row.user_id, row]));
        const listed = new Map(staff.map(member => [member.id, member]));
        if (!current) for (const userId of reviews.keys()) {
            const member = members.get(userId);
            if (member && !member.user.bot) listed.set(userId, member);
        }
        const sorted = [...listed.values()].sort((a, b) => activity.points(activity.metrics(guild.id, b.id, start).weekly) -
            activity.points(activity.metrics(guild.id, a.id, start).weekly));
        const chunks = [];
        let chunk = '';
        for (const member of sorted) {
            const entry = `${line(guild, member, start, reviews.get(member.id)?.goal || config.goal,
                current, tracked.get(member.id), reviews.get(member.id))}\n\n`;
            if (chunk.length + entry.length > 3800) { chunks.push(chunk); chunk = ''; }
            chunk += entry;
        }
        if (chunk) chunks.push(chunk);
        const title = `🛡️ Actividad ${current ? 'semanal' : 'de la semana anterior'} · Staff`;
        const embeds = (chunks.length ? chunks : ['Todavía no hay miembros con roles de Staff o Moderator.'])
            .slice(0, 10).map((description, index) => new EmbedBuilder()
                .setTitle(index === 0 ? title : `${title} (${index + 1})`)
                .setDescription(description)
                .setFooter({ text: `Lunes a lunes UTC · ${current ? 'Semana en curso' : 'Semana cerrada'} · Meta: ${config.goal} puntos` }));
        embeds[0].setAuthor({ name: `Del ${new Date(start).toLocaleDateString('es-MX', { timeZone: 'UTC' })} al ${new Date(start + activity.WEEK_MS).toLocaleDateString('es-MX', { timeZone: 'UTC' })}` });
        await interaction.editReply({ embeds, allowedMentions: { parse: [] } });
    },
};
