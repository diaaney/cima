const { ChannelType } = require('discord.js');
const { getVoicemasterConfig, createRoom, deleteRoom, getAllRooms } = require('../utils/storage');

const creatingRooms = new Set();
const watchedRooms = new Map();

function hasHumanMembers(channel, guild) {
    if (channel.members) return channel.members.some(member => !member.user.bot);
    return guild.voiceStates.cache.some(state =>
        state.channelId === channel.id && state.member?.user?.bot !== true);
}

function watchRoom(channel, guild) {
    if (watchedRooms.has(channel.id)) return;
    const createdAt = Date.now();
    let deleting = false;
    const interval = setInterval(async () => {
        if (deleting || Date.now() - createdAt < 15000) return;
        if (hasHumanMembers(channel, guild)) return;

        deleting = true;
        try {
            await channel.delete();
            deleteRoom(channel.id);
            clearInterval(interval);
            watchedRooms.delete(channel.id);
        } catch (error) {
            if (error?.code === 10003) {
                deleteRoom(channel.id);
                clearInterval(interval);
                watchedRooms.delete(channel.id);
                return;
            }
            console.error('[VoiceMaster] No pude eliminar la sala vacía:', error?.message || error);
        } finally {
            deleting = false;
        }
    }, 2000);
    watchedRooms.set(channel.id, interval);
}

module.exports = (client) => {
    let resuming = false;
    async function resumeRooms() {
        if (resuming) return;
        resuming = true;
        try {
            for (const room of getAllRooms()) {
                if (watchedRooms.has(room.channel_id)) continue;
                try {
                    const channel = client.channels.cache?.get(room.channel_id)
                        ?? await client.channels.fetch(room.channel_id);
                    if (!channel) {
                        deleteRoom(room.channel_id);
                        continue;
                    }
                    watchRoom(channel, channel.guild);
                } catch (error) {
                    if (error?.code === 10003) deleteRoom(room.channel_id);
                    else console.error('[VoiceMaster] No pude vigilar la sala guardada:', error?.message || error);
                }
            }
        } catch (error) {
            console.error('[VoiceMaster] No pude recuperar las salas:', error?.message || error);
        } finally {
            resuming = false;
        }
    }

    client.once('ready', () => {
        void resumeRooms();
        setInterval(() => { void resumeRooms(); }, 60_000);
    });

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
