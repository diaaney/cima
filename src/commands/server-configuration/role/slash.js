const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { setAutoroleConfig } = require('../../../utils/storage');

function singleRoleSubcommand(subcommand, name, description, roleDescription) {
    return subcommand.setName(name)
        .setDescription(description)
        .addRoleOption(option => option.setName('role').setDescription(roleDescription).setRequired(true));
}

function roleError(role, guild, botMember) {
    if (role.id === guild.id) return 'No puedes usar **@everyone** aquí.';
    if (role.managed) return `${role} está administrado por una integración y no puedo modificarlo.`;
    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
        return `Mi rol más alto debe estar por encima de ${role}.`;
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Administra roles de los miembros')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand => singleRoleSubcommand(
            subcommand, 'join', 'Da un rol automáticamente a los nuevos miembros', 'Rol para nuevos miembros',
        ))
        .addSubcommand(subcommand => singleRoleSubcommand(
            subcommand, 'all', 'Da un rol a todos los miembros', 'Rol que se dará',
        ))
        .addSubcommand(subcommand => singleRoleSubcommand(
            subcommand, 'removeall', 'Quita un rol a todos los miembros que lo tengan', 'Rol que se quitará',
        ))
        .addSubcommand(subcommand => subcommand
            .setName('convert')
            .setDescription('Cambia un rol por otro en todos los miembros que lo tengan')
            .addRoleOption(option => option
                .setName('roltarget')
                .setDescription('Rol actual de los miembros')
                .setRequired(true))
            .addRoleOption(option => option
                .setName('nuevorol')
                .setDescription('Rol que recibirán en su lugar')
                .setRequired(true))),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('[Role] Falló la respuesta inicial a Discord:', error?.message || error);
            throw error;
        }

        const mode = interaction.options.getSubcommand();
        const editReply = async payload => {
            try {
                return await interaction.editReply(payload);
            } catch (error) {
                console.error(`[Role ${mode}] Falló la respuesta final a Discord:`, error?.message || error);
                throw error;
            }
        };
        const { guild } = interaction;
        const botMember = guild.members.me ?? await guild.members.fetchMe();
        const sourceRole = interaction.options.getRole(mode === 'convert' ? 'roltarget' : 'role');
        const newRole = mode === 'convert' ? interaction.options.getRole('nuevorol') : null;

        for (const role of [sourceRole, newRole].filter(Boolean)) {
            const error = roleError(role, guild, botMember);
            if (error) return editReply({ embeds: [embeds.error(error)] });
        }

        if (mode === 'convert') {
            if (sourceRole.id === newRole.id) {
                return editReply({ embeds: [embeds.info('El rol actual y el nuevo son el mismo.')] });
            }

            if (interaction.user.id !== guild.ownerId) {
                const member = interaction.member;
                for (const role of [sourceRole, newRole]) {
                    if (member.roles.highest.comparePositionTo(role) <= 0) {
                        return editReply({
                            embeds: [embeds.error(`Tu rol más alto debe estar por encima de ${role}.`)],
                        });
                    }
                }
            }

            let members;
            try {
                members = await guild.members.fetch();
            } catch (error) {
                console.error('[Role convert] Falló la consulta de miembros:', error?.message || error);
                throw error;
            }
            const targets = members.filter(member => !member.user.bot && member.roles.cache.has(sourceRole.id));
            console.log(`[Role convert] Encontré ${targets.size} miembros para convertir.`);
            if (targets.size === 0) {
                return editReply({
                    embeds: [embeds.info(`Ninguna persona tiene ${sourceRole}. No hubo cambios.`)],
                });
            }

            let converted = 0;
            let failed = 0;
            let partial = 0;
            const targetList = [...targets.values()];
            for (let index = 0; index < targetList.length; index += 5) {
                await Promise.all(targetList.slice(index, index + 5).map(async member => {
                    let added = false;
                    try {
                        if (!member.roles.cache.has(newRole.id)) {
                            await member.roles.add(newRole, 'role conversion via /role convert');
                            added = true;
                        }
                        await member.roles.remove(sourceRole, 'role conversion via /role convert');
                        converted++;
                    } catch (error) {
                        failed++;
                        if (added) partial++;
                        console.error(`[Role Convert] No pude convertir al miembro ${member.id}:`, error?.message || error);
                    }
                }));
            }

            const details = failed
                ? `\nFallaron **${failed}**. ${partial ? `De ellos, **${partial}** recibieron el rol nuevo pero conservaron el anterior.` : ''}`
                : '';
            return editReply({
                embeds: [embeds.success(`Convertí ${sourceRole} → ${newRole} para **${converted}** de **${targets.size}** personas.${details}`)],
            });
        }

        if (mode === 'join') {
            setAutoroleConfig(guild.id, sourceRole.id);
            return editReply({
                embeds: [embeds.success(`Los nuevos miembros recibirán ${sourceRole} automáticamente.`)],
            });
        }

        const members = await guild.members.fetch();
        const nonBots = members.filter(member => !member.user.bot);
        const isAdd = mode === 'all';
        const targets = isAdd
            ? nonBots.filter(member => !member.roles.cache.has(sourceRole.id))
            : nonBots.filter(member => member.roles.cache.has(sourceRole.id));

        if (targets.size === 0) {
            return editReply({
                embeds: [embeds.info(isAdd
                    ? `Todos ya tienen ${sourceRole}. No hubo cambios.`
                    : `Nadie tiene ${sourceRole}. No hubo cambios.`)],
            });
        }

        let success = 0;
        let failed = 0;
        for (const member of targets.values()) {
            try {
                if (isAdd) {
                    await member.roles.add(sourceRole, 'bulk add via /role all');
                } else {
                    await member.roles.remove(sourceRole, 'bulk remove via /role removeall');
                }
                success++;
            } catch {
                failed++;
            }
        }

        const action = isAdd ? 'Di' : 'Quité';
        const details = failed ? `\nNo pude actualizar a **${failed}** miembros.` : '';
        return editReply({
            embeds: [embeds.success(`${action} ${sourceRole} a **${success}** miembros.${details}`)],
        });
    },
};
