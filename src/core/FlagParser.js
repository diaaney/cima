module.exports = function parseFlags(args) {
    const flags = {};
    const rest = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        // --key=value
        if (arg.startsWith('--') && arg.includes('=')) {
            const [key, value] = arg.slice(2).split('=');
            flags[key] = value;
        }

        // --key value OR --key
        else if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : true;
            flags[key] = value;
            if (value !== true) i++; // saltar valor leído
        }

        // -k
        else if (arg.startsWith('-') && arg.length === 2) {
            const key = arg[1];
            flags[key] = true;
        }

        // cualquier otra cosa
        else {
            rest.push(arg);
        }
    }

    return { flags, rest };
};
