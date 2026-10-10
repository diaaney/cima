const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getWelcomeConfig, setWelcomeChannel, setWelcomeFeaturedChannels, setWelcomeImage } = require('../../../utils/storage');
const { buildWelcomeDescription } = require('../../../utils/welcomeMessage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('configure welcome messages for new members')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('configure the welcome channel (admin only)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('channel where welcome messages will be sent')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('featured1')
                        .setDescription('1st channel to feature inside the welcome message')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('featured2')
                        .setDescription('2nd channel to feature inside the welcome message')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('featured3')
                        .setDescription('3rd channel to feature inside the welcome message')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('image')
                        .setDescription('image url to add to the welcome embed (does not replace the user avatar)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('test the welcome message in the configured channel')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            // Check for admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    embeds: [embeds.error('nah, you need administrator permissions to use this command')],
                    ephemeral: true
                });
            }

            const channel = interaction.options.getChannel('channel');

            // Optional channels to feature inside the welcome message
            const featured = [
                interaction.options.getChannel('featured1'),
                interaction.options.getChannel('featured2'),
                interaction.options.getChannel('featured3'),
            ].filter(Boolean);

            // Optional image url for the welcome embed (must be a valid http(s) url)
            const imageUrl = interaction.options.getString('image');
            if (imageUrl && !/^https?:\/\/.+/i.test(imageUrl)) {
                return interaction.reply({
                    embeds: [embeds.error('that image url is not valid. it must start with `http://` or `https://`')],
                    ephemeral: true
                });
            }

            // Save the welcome channel + featured channels + image
            const guildId = interaction.guild.id;
            setWelcomeChannel(guildId, channel.id);
            setWelcomeFeaturedChannels(guildId, featured.map(c => c.id));
            setWelcomeImage(guildId, imageUrl);

            // Defer reply to prevent interaction timeout
            await interaction.deferReply({ ephemeral: true });

            // Animation delay (1200ms)
            await new Promise(resolve => setTimeout(resolve, 1200));

            const featuredLine = featured.length
                ? `\n\nfeatured channels: ${featured.map(c => `${c}`).join('  ')}`
                : '';
            const imageLine = imageUrl ? `\n\nembed image set ✅` : '';

            await interaction.editReply({
                embeds: [embeds.success(`welcome channel set to ${channel}! ✨${featuredLine}${imageLine}\n\nuse \`/welcome test\` to preview the message`)]
            });
        }

        if (subcommand === 'test') {
            // Get welcome configuration
            const welcomeConfig = getWelcomeConfig(interaction.guild.id);

            if (!welcomeConfig.channel_id) {
                return interaction.reply({
                    embeds: [embeds.error('nah, you need to configure a welcome channel first using `/welcome setup`')],
                    ephemeral: true
                });
            }

            // Get the configured channel
            const welcomeChannel = await interaction.guild.channels.fetch(welcomeConfig.channel_id);

            if (!welcomeChannel) {
                return interaction.reply({
                    embeds: [embeds.error('the configured welcome channel no longer exists. please run `/welcome setup` again')],
                    ephemeral: true
                });
            }

            // Defer reply to prevent interaction timeout
            await interaction.deferReply({ ephemeral: true });

            // Animation delay (1200ms)
            await new Promise(resolve => setTimeout(resolve, 1200));

            const user = interaction.user;
            const member = interaction.member;
            const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 });

            const welcomeEmbed = new EmbedBuilder()
                .setColor(embeds.NEUTRAL_COLOR)
                .setAuthor({
                    name: `wlc ${member.displayName} <3`,
                    iconURL: avatarURL
                })
                .setDescription(buildWelcomeDescription(interaction.guild))
                .setThumbnail(avatarURL)
                .setFooter({ text: `users | ${interaction.guild.memberCount}` });

            // Optional embed image (does not replace the user avatar)
            if (welcomeConfig.image_url) {
                welcomeEmbed.setImage(welcomeConfig.image_url);
            }

            // Send to welcome channel
            await welcomeChannel.send({
                content: `${member}`,
                embeds: [welcomeEmbed]
            });

            // Confirm to user
            await interaction.editReply({
                embeds: [embeds.success(`test message sent to ${welcomeChannel}! ✨`)]
            });
        }
    }
};
