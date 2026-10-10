const { getWelcomeConfig } = require('./storage');

// Build the welcome embed description, featuring the configured channels (if any)
function buildWelcomeDescription(guild) {
    const { featured_channels } = getWelcomeConfig(guild.id);
    const featured = (featured_channels || []).filter(Boolean);

    let description = `wlc to ${guild.name}! ⸜(｡˃ ᵕ ˂ )⸝♡`;

    if (featured.length) {
        const line = featured.map(id => `<#${id}>`).join('      ');
        description += `\n\n${line}`;
    }

    return description;
}

module.exports = { buildWelcomeDescription };
