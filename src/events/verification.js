const crypto = require('crypto');
const { Resend } = require('resend');
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, EmbedBuilder, Events,
} = require('discord.js');
const embeds = require('../constants/embeds');
const store = require('../utils/verificationStore');

const EMAIL_BUTTON = 'cima_verify_email';
const CODE_BUTTON = 'cima_verify_code';
const EMAIL_MODAL = 'cima_verify_email_modal';
const CODE_MODAL = 'cima_verify_code_modal';

function settings() {
    return {
        guildId: process.env.GUILD_ID?.trim(),
        unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID?.trim(),
        aspiranteRoleId: process.env.ASPIRANTE_ROLE_ID?.trim(),
        domain: (process.env.INSTITUTIONAL_EMAIL_DOMAIN || 'uabc.edu.mx').toLowerCase().trim(),
    };
}

function ready() {
    const { guildId, unverifiedRoleId, aspiranteRoleId } = settings();
    return Boolean(guildId && unverifiedRoleId && aspiranteRoleId && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function applyVerifiedRoles(member) {
    const { unverifiedRoleId, aspiranteRoleId } = settings();
    if (!member.roles.cache.has(aspiranteRoleId)) {
        await member.roles.add(aspiranteRoleId, 'Correo institucional UABC verificado por Cima');
    }
    if (member.roles.cache.has(unverifiedRoleId)) {
        await member.roles.remove(unverifiedRoleId, 'Correo institucional UABC verificado por Cima');
    }
}

function emailValid(email, domain) {
    const parts = email.split('@');
    return parts.length === 2 && /^[a-z0-9._%+-]{1,64}$/i.test(parts[0]) && parts[1] === domain && email.length <= 254;
}

function button(id, label) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary)
    );
}

function welcomeEmbed(guildName) {
    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle(`bienvenid@ a ${guildName} ♡`)
        .setDescription('Para acceder a Comunidad UABC, verifica tu correo institucional. Haz clic abajo, escribe tu correo y recibirás un código válido durante 10 minutos. Después de ingresarlo, Cima te dará el rol Aspirante y quitará tu rol sin verificar.')
        .setFooter({ text: 'Cima • verificación UABC' });
}

async function sendPrompt(user, guildName) {
    return user.send({ embeds: [welcomeEmbed(guildName)], components: [button(EMAIL_BUTTON, 'Verificar mi correo')] });
}

function modal(id, title, fieldId, label, placeholder, maxLength) {
    return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId(fieldId).setLabel(label).setPlaceholder(placeholder)
                .setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(maxLength).setRequired(true)
        )
    );
}

async function sendCode(email, code) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: [email],
        subject: 'Cima | código de verificación UABC',
        text: `Tu código de verificación para Comunidad UABC es: ${code}\n\nCaduca en 10 minutos. Si no lo solicitaste, ignora este correo.`,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
}

async function targetMember(client, userId) {
    const { guildId } = settings();
    const guild = guildId ? await client.guilds.fetch(guildId).catch(() => null) : null;
    return guild ? guild.members.fetch(userId).catch(() => null) : null;
}

async function handle(interaction) {
    const known = [EMAIL_BUTTON, CODE_BUTTON, EMAIL_MODAL, CODE_MODAL];
    if (!known.includes(interaction.customId)) return false;

    if (!ready()) {
        await interaction.reply({ embeds: [embeds.error('La verificación aún no está configurada. Contacta al equipo del servidor.')], ephemeral: true });
        return true;
    }
    const member = await targetMember(interaction.client, interaction.user.id);
    if (!member) {
        await interaction.reply({ embeds: [embeds.error('Necesitas estar en Comunidad UABC para verificarte.')], ephemeral: true });
        return true;
    }
    const { domain } = settings();
    if (store.read().verified[interaction.user.id]) {
        try { await applyVerifiedRoles(member); }
        catch (error) {
            console.error('[Verification] Could not apply verified roles:', error);
            await interaction.reply({ embeds: [embeds.error('Tu correo ya está verificado, pero no pude actualizar tus roles. Usa /verificar otra vez o avisa al equipo del servidor.')], ephemeral: true });
            return true;
        }
        await interaction.reply({ embeds: [embeds.success('Tu correo ya está verificado ♡')], ephemeral: true });
        return true;
    }

    if (interaction.customId === EMAIL_BUTTON) {
        await interaction.showModal(modal(EMAIL_MODAL, 'Verifica tu correo UABC', 'email', 'Correo institucional', `tu.nombre@${domain}`, 254));
        return true;
    }
    if (interaction.customId === CODE_BUTTON) {
        await interaction.showModal(modal(CODE_MODAL, 'Ingresa tu código', 'code', 'Código de 6 dígitos', '123456', 6));
        return true;
    }
    if (interaction.customId === EMAIL_MODAL) {
        const email = interaction.fields.getTextInputValue('email').trim().toLowerCase();
        if (!emailValid(email, domain)) {
            await interaction.reply({ embeds: [embeds.error(`Usa un correo válido que termine exactamente en @${domain}.`)], ephemeral: true });
            return true;
        }
        const problem = store.inspect(interaction.user.id, email);
        if (problem) {
            const messages = {
                verified: 'Ya verificaste tu cuenta.',
                email_used: 'Ese correo ya está vinculado con otra cuenta de Discord.',
                email_pending: 'Ese correo ya tiene una verificación pendiente.',
                rate_limited: 'Espera al menos un minuto antes de pedir otro código.',
            };
            await interaction.reply({ embeds: [embeds.error(messages[problem])], ephemeral: true });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        try {
            const race = store.begin(interaction.user.id, email, code);
            if (race) {
                await interaction.editReply({ embeds: [embeds.error('Esta verificación cambió. Inténtalo de nuevo en un minuto.')] });
                return true;
            }
            await sendCode(email, code);
            await interaction.editReply({
                embeds: [embeds.success(`Envié un código a **${email}**. Revisa tu bandeja y spam; caduca en 10 minutos.`)],
                components: [button(CODE_BUTTON, 'Ingresar código')],
            });
        } catch (error) {
            store.cancel(interaction.user.id);
            console.error('[Verification] email delivery failed:', error);
            await interaction.editReply({ embeds: [embeds.error('No pude enviar el correo. Inténtalo más tarde o avisa al equipo del servidor.')] });
        }
        return true;
    }
    if (interaction.customId === CODE_MODAL) {
        const code = interaction.fields.getTextInputValue('code').trim();
        if (!/^\d{6}$/.test(code)) {
            await interaction.reply({ embeds: [embeds.error('El código debe tener 6 dígitos.')], ephemeral: true });
            return true;
        }
        const result = store.check(interaction.user.id, code);
        if (result) {
            const messages = {
                missing: 'No tienes un código pendiente. Inicia la verificación otra vez.',
                expired: 'El código caducó. Solicita uno nuevo.',
                incorrect: 'Código incorrecto. Revisa el correo e inténtalo de nuevo.',
                locked: 'Agotaste los intentos. Solicita un código nuevo.',
                email_used: 'Ese correo ya fue verificado por otra cuenta.',
            };
            await interaction.reply({ embeds: [embeds.error(messages[result])], ephemeral: true });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            store.complete(interaction.user.id);
        } catch (error) {
            console.error('[Verification] Could not save verification:', error);
            await interaction.editReply({ embeds: [embeds.error('El código es correcto, pero no pude completar la verificación. Avísale al equipo del servidor y vuelve a intentarlo.')] });
            return true;
        }
        try {
            await applyVerifiedRoles(member);
        } catch (error) {
            console.error('[Verification] Could not apply verified roles:', error);
            await interaction.editReply({ embeds: [embeds.error('Tu correo ya está verificado, pero no pude actualizar tus roles. Usa /verificar otra vez o avisa al equipo del servidor.')] });
            return true;
        }
        await interaction.editReply({ embeds: [embeds.success('¡Correo verificado! Ya puedes acceder a Comunidad UABC ♡')] });
        return true;
    }
    return true;
}

module.exports = (client) => {
    if (!ready()) console.warn('[Verification] Missing GUILD_ID, UNVERIFIED_ROLE_ID, ASPIRANTE_ROLE_ID or Resend settings.');
    client.on(Events.GuildMemberAdd, async member => {
        if (member.user.bot || member.guild.id !== settings().guildId) return;
        if (store.read().verified[member.id]) {
            try { await applyVerifiedRoles(member); }
            catch (error) { console.error('[Verification] Could not apply verified roles:', error); }
            return;
        }
        try { await member.roles.add(settings().unverifiedRoleId, 'Pendiente de verificación UABC'); }
        catch (error) { console.error('[Verification] Could not assign unverified role:', error); }
        try { await sendPrompt(member.user, member.guild.name); }
        catch (error) { console.warn(`[Verification] Could not DM ${member.id}: ${error.message}`); }
    });
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;
        if (![EMAIL_BUTTON, CODE_BUTTON, EMAIL_MODAL, CODE_MODAL].includes(interaction.customId)) return;
        try { await handle(interaction); }
        catch (error) {
            console.error('[Verification] interaction failed:', error);
            const payload = { embeds: [embeds.error('Ocurrió un error. Inténtalo de nuevo más tarde.')], ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
            else await interaction.reply(payload).catch(() => {});
        }
    });
};

module.exports.sendPrompt = sendPrompt;
