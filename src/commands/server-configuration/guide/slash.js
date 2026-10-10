const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getCountingConfig, getVoicemasterConfig, getWelcomeConfig } = require('../../../utils/storage');
const { RANKS, BOOSTER_ROLE_ID, BOOSTER_XP_MULTIPLIER, UABC_TAG_XP_MULTIPLIER } = require('../../../utils/levelSystem');

const RULES_CHANNEL_ID = '1552775123222794250';
const GENERAL_CHANNEL_ID = '1512976564541849760';
const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID?.trim() || '1558337666729115678';
const EARLY_SUPPORTER_ROLE_ID = '1558478077976252479';
const RANK_COLORS = {
    'Leyenda Cimarrona': 'Custom',
    'Orgullo Cimarrón': 'Golden',
    'Cimarrón Veterano': 'Crimson',
    'Cimarrón Avanzado': 'Holo',
};

function buildInfoEmbeds(guild) {
    const emoji = name => {
        const found = guild.emojis?.cache.find(item => item.name === name);
        return found ? `<:${found.name}:${found.id}>` : '';
    };
    const uabcTag = emoji('uabc_tag') || '**UABC**';
    const rankEmoji = {
        'Leyenda Cimarrona': emoji('rank_lightning'),
        'Cimarrón Avanzado': emoji('rank_holo'),
        'Cimarrón Veterano': emoji('rank_crimson'),
        'Orgullo Cimarrón': emoji('rank_golden'),
    };
    const countingId = getCountingConfig(guild.id).channel_id;
    const voice = getVoicemasterConfig(guild.id);
    const welcomeId = getWelcomeConfig(guild.id).channel_id;
    const counting = countingId ? `<#${countingId}>` : 'el canal de contar';
    const generator = voice.generator_id ? `<#${voice.generator_id}>` : 'el canal para crear voice chats';
    const panel = voice.panel_id ? `<#${voice.panel_id}>` : 'el panel de voz';

    const welcomeEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('Bienvenido a Nexo UABC')
        .setDescription(
            `Esta es la comunidad de Discord para convivir entre cimarrones. Empieza por <#${RULES_CHANNEL_ID}> y respeta las [normas de Discord](https://discord.com/guidelines).\n\n` +
            `**XP extra** · Con el tag ${uabcTag} visible ganas **x${UABC_TAG_XP_MULTIPLIER} XP**; con <@&${BOOSTER_ROLE_ID}> ${emoji('booster_gem')} ganas **x${BOOSTER_XP_MULTIPLIER} XP**. Ambos aplican a mensajes válidos y a cada premio de 10 números en counting. **No se acumulan:** si tienes los dos, se aplica x${BOOSTER_XP_MULTIPLIER}.\n\n` +
            `**Dónde ir**\n` +
            `• <#${GENERAL_CHANNEL_ID}> · plática y conoce a la comunidad.\n` +
            `• ${counting} · cuenta en orden sin repetir turno; un error reinicia la cuenta.\n` +
            `• ${generator} · entra para crear tu propio voice chat.\n` +
            `• ${panel} · personaliza ese canal de voz.${welcomeId && welcomeId !== GENERAL_CHANNEL_ID ? `\n• <#${welcomeId}> · recibe a quienes llegan.` : ''}`
        );

    const commandsEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('Comandos de Cima')
        .setDescription(
            `**Para empezar**\n` +
            `• \`/nivel\` · mira tu nivel y progreso; puedes consultar a otra persona.\n` +
            `• \`/top\` · elige el top de niveles o de counting.\n\n` +
            `**En la comunidad**\n` +
            `• \`/afk\` · avisa que estás ausente.\n` +
            `• \`/avatar\`, \`/banner\` y \`/serverinfo\` · consulta perfiles y el servidor.\n` +
            `• \`/poll\` · crea una encuesta. \`/ping\` · comprueba la respuesta del bot.\n` +
            `• \`/loot\` · mira tus puntos e inventario de counting. \`/use\` · usa un objeto.`
        );

    const ranksEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('Rangos y niveles')
        .setDescription(
            `<@&${UNVERIFIED_ROLE_ID}> limita el acceso hasta confirmar tu correo. Al verificarte recibes <@&${RANKS[0].id}>. Después, Cima cambia automáticamente tu rango al subir de nivel:\n\n` +
            [...RANKS].reverse().map(rank => `• <@&${rank.id}>${rankEmoji[rank.name] ? ` ${rankEmoji[rank.name]}` : ''}${RANK_COLORS[rank.name] ? ` (**${RANK_COLORS[rank.name]}**)` : ''} · nivel **${rank.level}**`).join('\n') +
            `\n\n**Roles especiales**\n` +
            `• <@&${BOOSTER_ROLE_ID}> ${emoji('booster_gem')} · x${BOOSTER_XP_MULTIPLIER} XP.\n` +
            `• <@&${EARLY_SUPPORTER_ROLE_ID}> ${emoji('early_supporter')} · reconocimiento a quienes apoyaron al servidor desde el inicio.\n\n` +
            `Cada mensaje válido fuera de counting da **20 XP**, como máximo una vez por minuto. Cada **10 números válidos** en counting dan otros **20 XP**. El tag ${uabcTag} da **x${UABC_TAG_XP_MULTIPLIER} XP** y Booster da **x${BOOSTER_XP_MULTIPLIER} XP**. **No se suman:** si tienes ambos, recibes x${BOOSTER_XP_MULTIPLIER}. Usa \`/nivel\` para ver tu progreso.`
        );

    return [welcomeEmbed, commandsEmbed, ranksEmbed];
}

function buildVerificationEmbed() {
    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('Verificación de Nexo UABC')
        .setDescription(
            `Debido a que entraron varias cuentas alternativas a causar desorden, usamos la verificación por correo institucional para cuidar Nexo UABC. Este canal es solo informativo; la verificación se hace por mensaje directo con **Cima**.\n\n` +
            `**Cómo verificarte**\n` +
            `1. Al entrar, **Cima** te envía un MD automáticamente. Ábrelo.\n` +
            `2. Pulsa **Verificar mi correo** y escribe tu dirección **@uabc.edu.mx**.\n` +
            `3. Revisa tu bandeja y spam. Recibirás un código de seis dígitos que caduca en **10 minutos**.\n` +
            `4. Pulsa **Ingresar código** en el MD. Cima te dará <@&${RANKS[0].id}> y quitará <@&${UNVERIFIED_ROLE_ID}>.\n\n` +
            `Si no recibes el MD, permite los mensajes directos de miembros de este servidor y avisa al equipo de moderación.`
        )
        .setFooter({ text: 'Privacidad: no pedimos contraseñas ni datos académicos. Conservamos tu correo, ID de Discord y fecha de verificación para evitar cuentas duplicadas; el código se guarda como hash.' });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription('Publica la guía de Nexo UABC')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand
            .setName('setup')
            .setDescription('Publica información o verificación en este canal')
            .addStringOption(option => option
                .setName('tipo')
                .setDescription('Qué tipo de guía quieres publicar')
                .setRequired(true)
                .addChoices(
                    { name: 'Información', value: 'info' },
                    { name: 'Verificación', value: 'verificacion' },
                ))),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                embeds: [embeds.error('Necesitas permisos de administrador para usar este comando.')],
                ephemeral: true,
            });
        }

        const type = interaction.options.getString('tipo', true);
        await interaction.deferReply({ ephemeral: true });
        if (type === 'info') await interaction.guild.emojis.fetch();
        const selected = type === 'verificacion' ? [buildVerificationEmbed()] : buildInfoEmbeds(interaction.guild);
        await interaction.channel.send({ embeds: selected, allowedMentions: { parse: [] } });
        await interaction.editReply({ embeds: [embeds.success(`Guía de ${type === 'info' ? 'información' : 'verificación'} publicada en ${interaction.channel}.`)] });
    },

    buildInfoEmbeds,
    buildVerificationEmbed,
};
