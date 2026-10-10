// Application (bot-owned) emojis.
//
// These render in ANY server the bot is in, so the bot no longer depends on the
// original home guild for its custom emojis. Run `node migrate-emojis.js` once to
// re-upload them to the application and overwrite the ids below automatically.
//
// Until that script runs, these ids point at the original home-guild emojis,
// which keep working as long as the bot stays in that server — so nothing breaks.

const emojis = {
    loading:    { name: 'loading',    id: '1488873167215792223', animated: true },
    lock:       { name: 'lock',       id: '1489059248292761754', animated: false },
    unlock:     { name: 'unlock',     id: '1489059333328080916', animated: false },
    ghost:      { name: 'ghost',      id: '1489059154650726491', animated: false },
    reveal:     { name: 'reveal',     id: '1489059277468340233', animated: false },
    claim:      { name: 'claim',      id: '1489058994344431810', animated: false },
    disconnect: { name: 'disconnect', id: '1489059111927808091', animated: false },
    start:      { name: 'start',      id: '1489059305696268402', animated: false },
    info:       { name: 'info',       id: '1489059218953732307', animated: false },
    increase:   { name: 'increase',   id: '1489059183008420031', animated: false },
    decrease:   { name: 'decrease',   id: '1489059046106599549', animated: false },
};

// Full markup string, e.g. "<a:loading:123>" — for use in message/embed text.
function markup(key) {
    const e = emojis[key];
    if (!e) return '';
    return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
}

// Raw id — for ButtonBuilder#setEmoji().
function id(key) {
    return emojis[key] ? emojis[key].id : null;
}

module.exports = { emojis, markup, id };
