const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const commandsPath = path.join(__dirname, '..', 'commands');

    const walk = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.name === 'slash.js') {
                const command = require(fullPath);
                client.commands.set(command.data.name, command);
            } else if (entry.name === 'prefix.js') {
                const command = require(fullPath);
                client.prefixCommands.set(command.name, command);
            }
        });
    };

    walk(commandsPath);
};
