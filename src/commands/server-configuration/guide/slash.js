const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getCountingConfig, getVoicemasterConfig, getWelcomeConfig } = require('../../../utils/storage');
const { RANKS } = require('../../../utils/levelSystem');

const RULES_CHANNEL_ID = '1552775123222794250';
const GENERAL_CHANNEL_ID = '1512976564541849760';

function buildGuideEmbeds(guild) {
    const countingId = getCountingConfig(guild.id).channel_id;
    const voice = getVoicemasterConfig(guild.id);
    const welcomeId = getWelcomeConfig(guild.id).channel_id;
    const counting = countingId ? `<#${countingId}>` : 'el canal de contar';
    const generator = voice.generator_id ? `<#${voice.generator_id}>` : 'el canal para crear voice chats';
    const panel = voice.panel_id ? `<#${voice.panel_id}>` : 'el panel de voz';

    const welcomeEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('✦ Bienvenid@ a Nexo UABC')
        .setDescription(
            `Esta es la comunidad de Discord para convivir entre cimarrones. Empieza por <#${RULES_CHANNEL_ID}> y respeta las [normas de Discord](https://discord.com/guidelines).\n\n` +
            `Si acabas de entrar, revisa el MD de **Cima** para verificar tu correo institucional. También puedes usar \`/verificar\`. Al completar el proceso se quita **Sin Verificar** y recibes **Aspirante**.\n\n` +
            `**Dónde ir**\n` +
            `• <#${GENERAL_CHANNEL_ID}> · plática y conoce a la comunidad.\n` +
            `• ${counting} · cuenta en orden sin repetir turno; un error reinicia la cuenta.\n` +
            `• ${generator} · entra para crear tu propio voice chat.\n` +
            `• ${panel} · personaliza ese canal de voz.${welcomeId && welcomeId !== GENERAL_CHANNEL_ID ? `\n• <#${welcomeId}> · recibe a quienes llegan.` : ''}`
        );

    const commandsEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('⌘ Comandos de Cima')
        .setDescription(
            `**Para empezar**\n` +
            `• \`/verificar\` · recibe por MD los pasos de verificación.\n` +
            `• \`/nivel\` · mira tu nivel y progreso; puedes consultar a otra persona.\n` +
            `• \`/top\` · elige el top de niveles o de counting.\n\n` +
            `**En la comunidad**\n` +
            `• \`/colors\` · escoge un color para tu perfil.\n` +
            `• \`/afk\` · avisa que estás ausente.\n` +
            `• \`/avatar\`, \`/banner\` y \`/serverinfo\` · consulta perfiles y el servidor.\n` +
            `• \`/poll\` · crea una encuesta. \`/ping\` · comprueba la respuesta del bot.\n` +
            `• \`/reactmessage\` · configura reacciones a mensajes.\n` +
            `• \`/loot\` · mira tus puntos e inventario de counting. \`/use\` · usa un objeto.\n\n` +
            `**Administración**\n` +
            `\`/guide setup\`, \`/welcome setup\`, \`/welcome test\`, \`/count setup\`, \`/voicemaster setup\`, \`/role\`, \`/membercount setup\` y \`/emoji add\`.`
        );

    const ranksEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('✧ Rangos y niveles')
        .setDescription(
            `**Sin Verificar** limita el acceso hasta confirmar tu correo. Al verificarte recibes **Aspirante**. Después, Cima cambia automáticamente tu rango al subir de nivel:\n\n` +
            RANKS.map(rank => `• **Nivel ${rank.level}** · ${rank.name}`).join('\n') +
            `\n\nCada mensaje válido fuera de counting da **20 XP**, como máximo una vez por minuto. Cada **10 números válidos** en counting dan otros **20 XP**. Usa \`/nivel\` para ver tu progreso. El rol **Booster** es independiente y no se reemplaza al subir de rango.`
        );

    const verifyEmbed = new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle('✉ Verificación UABC')
        .setDescription(
            `Debido a que entraron varias cuentas alternativas a causar desorden, usamos la verificación por correo institucional para cuidar la comunidad.\n\n` +
            `**Cómo verificarte**\n` +
            `1. Abre el MD que te envía **Cima** al entrar. Si no llegó, activa los MD del servidor y usa \`/verificar\`.\n` +
            `2. Pulsa **Verificar mi correo** y escribe tu dirección **@uabc.edu.mx**.\n` +
            `3. Revisa tu bandeja y spam. Recibirás un código de seis dígitos que caduca en **10 minutos**.\n` +
            `4. Pulsa **Ingresar código** en el MD. Cima te dará **Aspirante** y quitará **Sin Verificar**.\n\n` +
            `**Tus datos:** nunca te pedimos contraseñas, matrícula ni acceso a tu correo. El código se guarda como hash, no en texto plano. Para impedir verificaciones duplicadas, sí guardamos tu correo institucional vinculado a tu ID de Discord y la fecha de verificación.`
        );

    return [welcomeEmbed, commandsEmbed, ranksEmbed, verifyEmbed];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription('Publica la guía de Nexo UABC')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand
            .setName('setup')
            .setDescription('Publica los embeds de la guía en este canal')
            .addIntegerOption(option => option
                .setName('embeds')
                .setDescription('Cantidad de embeds en orden (1 a 4; por defecto, todos)')
                .setMinValue(1)
                .setMaxValue(4))),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                embeds: [embeds.error('Necesitas permisos de administrador para usar este comando.')],
                ephemeral: true,
            });
        }

        const embedCount = interaction.options.getInteger('embeds') ?? 4;
        await interaction.deferReply({ ephemeral: true });
        await interaction.channel.send({ embeds: buildGuideEmbeds(interaction.guild).slice(0, embedCount) });
        await interaction.editReply({ embeds: [embeds.success(`Guía publicada en ${interaction.channel}.`)] });
    },

    buildGuideEmbeds,
};
