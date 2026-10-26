require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const { database } = require('./src/utils/database');

if (database().prepare('PRAGMA quick_check').get().quick_check !== 'ok') {
    throw new Error('Cima SQLite database failed its startup check');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

client.commands = new Collection();
client.prefixCommands = new Collection();

require('./src/core/CommandHandler')(client);
require('./src/events/ready.js')(client);
require('./src/events/countingIdle.js')(client);
require('./src/events/interactionCreate.js')(client);
require('./src/events/messageCreate.js')(client);
require('./src/events/welcomeReactions.js')(client);
require('./src/events/leveling.js')(client);
require('./src/events/messageDelete.js')(client);
require('./src/events/voiceStateUpdate.js')(client);
require('./src/events/guildMemberAdd.js')(client);
require('./src/events/memberCount.js')(client);
require('./src/events/verification.js')(client);
require('./src/events/gameRoleVerification.js')(client);
require('./src/events/tickets.js')(client);
require('./src/events/singleGuild.js')(client);

let loginRetryMs = 5_000;

async function login() {
    try {
        await client.login(process.env.DISCORD_TOKEN);
        loginRetryMs = 5_000;
    } catch (error) {
        console.error('[Cima] No pude conectar con Discord. Reintentaré el inicio:', error);
        setTimeout(login, loginRetryMs);
        loginRetryMs = Math.min(loginRetryMs * 2, 60_000);
    }
}

void login();
