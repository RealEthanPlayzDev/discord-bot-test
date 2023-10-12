import type { MeteoriumEvent } from ".";
import { MeteoriumEmbedBuilder } from "../util/MeteoriumEmbedBuilder";

export const Event: MeteoriumEvent<"interactionCreate"> = {
    async Callback(client, interaction) {
        if (!interaction.inCachedGuild()) return;
        if (interaction.isChatInputCommand()) {
            const Command = client.Commands.get(interaction.commandName);
            if (Command == undefined)
                return console.error(
                    "Unexpected behavior when handling slash command interaction: " +
                        interaction.commandName +
                        " doesn't exist on client.Commands.",
                );

            let GuildExistInDb = await client.Database.guild.findUnique({ where: { GuildId: interaction.guildId } });
            if (GuildExistInDb == null) GuildExistInDb = await client.Database.guild.create({ data: { GuildId: interaction.guildId } });

            if (GuildExistInDb && GuildExistInDb.LoggingChannelId != "") {
                client.channels.fetch(GuildExistInDb.LoggingChannelId).then(async(channel) => {
                    if (channel != null && channel.isTextBased()) await channel.send({ embeds: [
                        new MeteoriumEmbedBuilder(undefined, interaction.user)
                            .setTitle("Command executed")
                            .setFields([
                                { name: "Command name", value: interaction.commandName },
                                { name: "Executor", value: `${interaction.user.username} (${interaction.user.id}) (<@${interaction.user.id}>)` }
                            ])
                            .setNormalColor()
                    ] });
                }).catch(() => null)
            }

            try {
                await Command.Callback(interaction, client);
            } catch (err) {
                console.error("Slash command callback error:\n" + err);
                const ErrorEmbed = new MeteoriumEmbedBuilder(undefined, interaction.user)
                    .setTitle("Error occurred while the command callback was running")
                    .setDescription(String(err))
                    .setErrorColor();
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: "Error occurred (if you don't see anything below, you have embeds disabled)",
                        embeds: [ErrorEmbed],
                    });
                } else {
                    await interaction.reply({
                        content: "Error occurred (if you don't see anything below, you have embeds disabled)",
                        embeds: [ErrorEmbed],
                        ephemeral: true,
                    });
                }
            }
        }

        return;
    },
};
