const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { STAFF_ROLE_IDS, ADMIN_ROLE_ID } = require('../../../constants/tickets');
const activity = require('../../../utils/staffActivity');

function roleIcon(guild, member, savedRoleId) {
    const roleId = member.roles.cache.has(ADMIN_ROLE_ID) ? ADMIN_ROLE_ID :
        savedRoleId || STAFF_ROLE_IDS.find(id => member.roles.cache.has(id));
    const icons = {
        [ADMIN_ROLE_ID]: ['rank_admin_crown', '👑'],
        [STAFF_ROLE_IDS[0]]: ['rank_staff_hammer', '🔨'],
        [STAFF_ROLE_IDS[1]]: ['rank_moderator_tools', '🛠️'],
    };
    const [name, fallback] = icons[roleId] || ['rank_staff_hammer', '🛡️'];
    const emoji = guild.emojis.cache.find(item => item.name === name);
    return emoji ? `${emoji}` : fallback;
}

function breakdown(value) {
    const parts = [
        [value.replies, 'respuesta'],
        [value.welcomes, 'bienvenida'],
        [value.suggestions, 'sugerencia'],
        [value.messages, 'mensaje'],
        [value.claims, 'ticket reclamado'],
        [value.closes, 'ticket cerrado'],
    ].filter(([count]) => count > 0)
        .map(([count, label]) => `${count} ${label}${count === 1 ? '' : 's'}`);
    return parts.length ? parts.join(' · ') : 'sin actividad registrada';
}

function section(record, current, firstFullWeek, start) {
    if (record.review?.status === 'removed') return 'missed';
    if (record.review?.status === 'exempt') return 'exempt';
    if (record.review?.status === 'ok') return 'fulfilled';
    if (record.review?.status === 'error') return 'error';
    if (record.member.roles.cache.has(ADMIN_ROLE_ID) ||
        record.member.permissions.has(PermissionFlagsBits.Administrator)) return 'exempt';
    if (!current && (start < firstFullWeek || record.tracked?.eligible_week > start)) return 'pending';
    if (record.score >= record.goal) return 'fulfilled';
    return current ? 'progress' : 'missed';
}

function activityEmbeds(guild, members, reviews, tracked, start, current, config) {
    const firstFullWeek = activity.nextWeekStart(config.started_week);
    const bottomBracket = guild.emojis.cache.find(emoji => emoji.name === 'bottombracket')?.toString() || '└';
    const records = members.map(member => {
        const values = activity.metrics(guild.id, member.id, start);
        const review = reviews.get(member.id);
        const record = {
            member, review, tracked: tracked.get(member.id), weekly: values.weekly,
            score: activity.points(values.weekly), total: activity.points(values.total),
            goal: review?.goal || config.goal,
        };
        record.section = section(record, current, firstFullWeek, start);
        return record;
    });
    const definitions = [
        ['fulfilled', '✅ META CUMPLIDA'],
        [current ? 'progress' : 'missed', current ? '📈 EN PROGRESO' : '❌ NO CUMPLIERON'],
        ['exempt', '⭐ EXENTOS'],
        ['pending', '🕒 SIN EVALUACIÓN'],
        ['error', '⚠️ REVISAR'],
    ];
    const date = new Intl.DateTimeFormat('es-MX', {
        timeZone: activity.TIME_ZONE, day: 'numeric', month: 'short',
    });
    const header = `**${date.format(start)} – ${date.format(activity.nextWeekStart(start))}** · Baja California\n` +
        `Meta semanal: **${config.goal} puntos**${current && start < firstFullWeek ? ' · semana de observación' : ''}`;
    const pages = [];
    let page = header;
    for (const [key, title] of definitions) {
        const group = records.filter(record => record.section === key)
            .sort((a, b) => b.score - a.score || a.member.id.localeCompare(b.member.id));
        if (!group.length) continue;
        let heading = `\n\n**${title} · ${group.length}**`;
        for (const record of group) {
            const detail = `${roleIcon(guild, record.member, record.review?.role_id)} ` +
                `<@${record.member.id}> · **${record.score}/${record.goal} pts** · total **${record.total}**\n` +
                `${bottomBracket} ${breakdown(record.weekly)}`;
            let row = `${heading}\n${detail}`;
            if (page.length + row.length > 3800 && page !== header) {
                pages.push(page);
                page = header;
                heading = `\n\n**${title} · continuación**`;
                row = `${heading}\n${detail}`;
            }
            page += row;
            heading = '';
        }
    }
    pages.push(records.length ? page : `${header}\n\nTodavía no hay miembros del equipo para mostrar.`);
    return pages.slice(0, 10).map((description, index) => {
        const embed = new EmbedBuilder()
            .setColor(embeds.NEUTRAL_COLOR)
            .setTitle(`🛡️ Actividad del equipo${pages.length > 1 ? ` · ${index + 1}/${pages.length}` : ''}`)
            .setDescription(description)
            .setFooter({ text: 'Respuestas 3 · bienvenidas 3 · sugerencias 4 · mensajes 1 · tickets 2/1 puntos' });
        const icon = guild.iconURL?.();
        if (icon) embed.setThumbnail(icon);
        return embed;
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Actividad semanal del equipo de moderación')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('activity').setDescription('Muestra la actividad semanal y total del equipo')
            .addStringOption(option => option.setName('semana').setDescription('Semana a consultar')
                .addChoices({ name: 'Actual', value: 'actual' }, { name: 'Anterior', value: 'anterior' })))
        .addSubcommand(sub => sub.setName('meta').setDescription('Ajusta los puntos semanales requeridos')
            .addIntegerOption(option => option.setName('puntos').setDescription('Entre 1 y 500 puntos')
                .setRequired(true).setMinValue(1).setMaxValue(500))),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Solo un administrador puede ver la actividad del equipo.' });
        }
        if (interaction.options.getSubcommand() === 'meta') {
            const goal = interaction.options.getInteger('puntos', true);
            activity.setGoal(interaction.guildId, goal);
            return interaction.reply({ content: `Meta semanal actualizada a **${goal} puntos**.` });
        }
        await interaction.deferReply();
        const guild = interaction.guild;
        const config = activity.settings(guild.id);
        const current = interaction.options.getString('semana') !== 'anterior';
        const start = current ? activity.weekStart() : activity.previousWeekStart();
        const members = await guild.members.fetch();
        const staff = [...members.values()].filter(member => !member.user.bot &&
            activity.TRACKED_ROLE_IDS.some(id => member.roles.cache.has(id)));
        for (const member of staff) activity.trackMember(member);
        const reviews = new Map(activity.reviews(guild.id, start).map(row => [row.user_id, row]));
        const tracked = new Map(activity.trackedMembers(guild.id).map(row => [row.user_id, row]));
        const listed = new Map(staff.map(member => [member.id, member]));
        if (!current) for (const userId of reviews.keys()) {
            const member = members.get(userId);
            if (member && !member.user.bot) listed.set(userId, member);
        }
        await interaction.editReply({
            embeds: activityEmbeds(guild, [...listed.values()], reviews, tracked, start, current, config),
            allowedMentions: { parse: [] },
        });
    },
};

module.exports.activityEmbeds = activityEmbeds;
