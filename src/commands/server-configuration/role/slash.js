const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { setAutoroleConfig } = require('../../../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('manage roles for members')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(opt =>
            opt.setName('mode')
                .setDescription('what to do with the role')
                .setRequired(true)
                .addChoices(
                    { name: 'join — set autorole for new members', value: 'join' },
                    { name: 'all — give role to every member', value: 'all' },
                    { name: 'removeall — remove role from everyone who has it', value: 'removeall' },
                )
        )
        .addRoleOption(opt =>
            opt.setName('role')
                .setDescription('the role to apply')
                .setRequired(true)
        ),

    async execute(interaction) {
        const mode = interaction.options.getString('mode');
        const role = interaction.options.getRole('role');
        const { guild } = interaction;
        const me = guild.members.me;

        if (role.id === guild.id) {
            return interaction.reply({
                embeds: [embeds.error('nah, you can\'t use **@everyone** here')],
                ephemeral: true
            });
        }

        if (role.managed) {
            return interaction.reply({
                embeds: [embeds.error('that role is managed by an integration — I can\'t hand it out')],
                ephemeral: true
            });
        }

        if (me.roles.highest.comparePositionTo(role) <= 0) {
            return interaction.reply({
                embeds: [embeds.error(`my highest role is below **${role.name}** — move my role above it and try again`)],
                ephemeral: true
            });
        }

        if (mode === 'join') {
            setAutoroleConfig(guild.id, role.id);
            return interaction.reply({
                embeds: [embeds.success(`new members will now get ${role} automatically ✨`)],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const members = await guild.members.fetch();
        const nonBots = members.filter(m => !m.user.bot);

        const isAdd = mode === 'all';
        const targets = isAdd
            ? nonBots.filter(m => !m.roles.cache.has(role.id))
            : nonBots.filter(m => m.roles.cache.has(role.id));

        if (targets.size === 0) {
            return interaction.editReply({
                embeds: [embeds.info(
                    isAdd
                        ? `everyone already has ${role} — nothing to do`
                        : `nobody has ${role} — nothing to remove`
                )]
            });
        }

        let success = 0;
        let failed = 0;

        for (const member of targets.values()) {
            try {
                if (isAdd) {
                    await member.roles.add(role, 'bulk add via /role all');
                } else {
                    await member.roles.remove(role, 'bulk remove via /role removeall');
                }
                success++;
            } catch {
                failed++;
            }
        }

        const verb = isAdd ? 'gave' : 'removed';
        const prep = isAdd ? 'to' : 'from';
        const failLine = failed > 0 ? `\n⚠️ failed on **${failed}** member(s)` : '';

        await interaction.editReply({
            embeds: [embeds.success(`${verb} ${role} ${prep} **${success}** member(s)${failLine}`)]
        });
    }
};
