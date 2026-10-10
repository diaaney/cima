const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, '..', 'commands');

// Recorrer todos los slash.js
const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.name === 'slash.js') {
            const command = require(fullPath);
            if (command.data) {
                commands.push(command.data.toJSON());
            }
        }
    });
};

walk(commandsPath);

// Deploy
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔁 Deploying slash commands...');
        // Opción 1: deploy en un solo servidor
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Slash commands deployed (guild only).');
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
