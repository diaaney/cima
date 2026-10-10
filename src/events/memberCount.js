const { Events } = require('discord.js');
const { getMembercountConfig } = require('../utils/storage');

function buildCategoryName(currentName, memberCount) {
    const baseName = currentName.replace(/\s+\d+$/, '');
    return `${baseName} ${memberCount}`;
}

async function updateCategoryName(guild) {
    try {
        const cfg = getMembercountConfig(guild.id);
        if (!cfg || !cfg.category_id) return;

        const category = await guild.channels.fetch(cfg.category_id).catch(() => null);
        if (!category) return;

        const newName = buildCategoryName(category.name, guild.memberCount);
        if (category.name === newName) return;

        await category.setName(newName, 'member count update');
    } catch (error) {
        console.error('[MemberCount] failed to update category name:', error.message);
    }
}

module.exports = (client) => {
    client.on(Events.ClientReady, async () => {
        for (const guild of client.guilds.cache.values()) {
            await updateCategoryName(guild);
        }
    });

    client.on(Events.GuildMemberAdd, (member) => updateCategoryName(member.guild));
    client.on(Events.GuildMemberRemove, (member) => updateCategoryName(member.guild));
};

// Exposed so /membercount setup can refresh the name immediately after config.
module.exports.updateCategoryName = updateCategoryName;
