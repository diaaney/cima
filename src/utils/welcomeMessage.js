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

    if (guild.id === UABC_GUILD_ID) {
        description += '\n\nRevisa tus MD de **Cima** para verificar tu correo institucional. Si no te llegó el mensaje, usa `/verificar`. Al verificarte recibirás **Aspirante** y podrás empezar a subir de nivel con `/nivel`.';
    }

    if (featured.length) {
        const descriptions = {
            '1552775123222794250': 'lee las reglas',
            '1512976564541849760': 'platica con la comunidad',
            '1558343245229203526': 'juega counting',
        };
        const lines = featured.map(id => `• <#${id}>${descriptions[id] ? ` · ${descriptions[id]}` : ''}`);
        description += `\n\n**Para empezar**\n${lines.join('\n')}`;
    }

    return description;
}

module.exports = { buildWelcomeDescription };
