const { getWelcomeConfig } = require('./storage');

const UABC_GUILD_ID = '1512970933399195658';
const UABC_FEATURED_CHANNELS = [
    '1552775123222794250',
    '1512976564541849760',
    '1558343245229203526',
];

// Build the welcome embed description, featuring the configured channels (if any)
function buildWelcomeDescription(guild) {
    const { featured_channels } = getWelcomeConfig(guild.id);
    const configured = (featured_channels || []).filter(Boolean);
    const featured = configured.length
        ? configured
        : (guild.id === UABC_GUILD_ID ? UABC_FEATURED_CHANNELS : []);

    let description = 'bienvenido a Nexo UABC ⸜(｡˃ ᵕ ˂ )⸝♡';

    if (featured.length) {
        const line = featured.map(id => `<#${id}>`).join('      ');
        description += `\n\n${line}`;
    }

    return description;
}

module.exports = { buildWelcomeDescription };
