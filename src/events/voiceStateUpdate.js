const { getVoicemasterConfig, createRoom, deleteRoom } = require('../utils/storage');

module.exports = (client) => {
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (oldState.channelId === newState.channelId) return;
        if (!newState.channelId || !newState.guild || !newState.member) return;

        const user = newState.member;
        const guild = newState.guild;
        const joinedChannel = newState.channel;

        const guildConfig = getVoicemasterConfig(guild.id);
        if (!guildConfig || !guildConfig.generator_id) return;

        const generatorId = guildConfig.generator_id;

        if (joinedChannel.id === generatorId) {
            const category = joinedChannel.parent;

            try {
                const newChannel = await guild.channels.create({
                    name: `${user.displayName}'s room`,
                    type: 2, // GuildVoice
                    parent: category ?? null,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: ['Connect'], // Ahora el canal estará desbloqueado
                        },
                        {
                            id: user.id,
                            allow: ['Connect', 'ManageChannels', 'MoveMembers'],
                        },
                    ],
                });

                await user.voice.setChannel(newChannel);

                // Save to JSON
                createRoom(newChannel.id, user.id);

                // Auto-delete when empty
                const interval = setInterval(() => {
                    if (!newChannel.members.size) {
                        newChannel.delete().catch(() => {});
                        deleteRoom(newChannel.id);
                        clearInterval(interval);
                    }
                }, 1000);
            } catch (err) {
                console.error('[VoiceMaster Error]', err);
            }
        }
    });
};
