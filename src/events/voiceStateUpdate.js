const { ChannelType } = require('discord.js');
const { getVoicemasterConfig, createRoom, deleteRoom } = require('../utils/storage');

const creatingRooms = new Set();

function watchRoom(channel, guild) {
    const createdAt = Date.now();
    let deleting = false;
    const interval = setInterval(async () => {
        if (deleting || Date.now() - createdAt < 15000) return;
        if (guild.voiceStates.cache.some(state => state.channelId === channel.id)) return;

        deleting = true;
        try {
            await channel.delete();
            deleteRoom(channel.id);
            clearInterval(interval);
        } catch (error) {
            if (error?.code === 10003) {
                deleteRoom(channel.id);
                clearInterval(interval);
                return;
            }
            console.error('[VoiceMaster] No pude eliminar la sala vacía:', error?.message || error);
        } finally {
            deleting = false;
        }
    }, 2000);
}

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

        if (newState.channelId === generatorId) {
            const requestKey = `${guild.id}:${user.id}`;
            if (creatingRooms.has(requestKey)) return;
            creatingRooms.add(requestKey);
            const category = joinedChannel?.parent ?? null;

            try {
                const newChannel = await guild.channels.create({
                    name: `${user.displayName}'s room`,
                    type: ChannelType.GuildVoice,
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

                createRoom(newChannel.id, user.id);
                watchRoom(newChannel, guild);

                if (guild.voiceStates.cache.get(user.id)?.channelId !== generatorId) return;
                await user.voice.setChannel(newChannel);
            } catch (err) {
                console.error('[VoiceMaster] No pude crear o mover al usuario:', err?.message || err);
            } finally {
                creatingRooms.delete(requestKey);
            }
        }
    });
};
