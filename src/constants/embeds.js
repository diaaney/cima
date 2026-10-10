const { EmbedBuilder } = require('discord.js');
const { getRandomVerb } = require('../utils/spinner');
const { markup } = require('./appEmojis');

// Neutral color matching Discord's embed background exactly
const NEUTRAL_COLOR = '#393A41'; // Discord dark mode embed background

module.exports = {
    // State embeds
    thinking: (message = 'Processing...') =>
        new EmbedBuilder()
            .setColor(NEUTRAL_COLOR)
            .setDescription(`${markup('loading')}\u00A0\u00A0${getRandomVerb()}...`),

    loading: (message = 'Loading...') =>
        new EmbedBuilder()
            .setColor(NEUTRAL_COLOR)
            .setDescription(`${markup('loading')}\u00A0\u00A0${getRandomVerb()}...`),

    // Result embeds
    success: (message) =>
        new EmbedBuilder()
            .setColor(NEUTRAL_COLOR)
            .setDescription(message),

    error: (message) =>
        new EmbedBuilder()
            .setColor(NEUTRAL_COLOR)
            .setDescription(message),

    info: (message) =>
        new EmbedBuilder()
            .setColor(NEUTRAL_COLOR)
            .setDescription(message),

    warn: (message) =>
        new EmbedBuilder()
            .setColor(NEUTRAL_COLOR)
            .setDescription(message),

    // Export color constant
    NEUTRAL_COLOR
};
