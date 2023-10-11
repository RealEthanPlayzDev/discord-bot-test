import { ModerationAction } from "@prisma/client";
import { SlashCommandBuilder } from "discord.js";
import type { MeteoriumCommand } from "..";
import { MeteoriumEmbedBuilder } from "../../util/MeteoriumEmbedBuilder";

export const Command: MeteoriumCommand = {
    InteractionData: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bans someone inside this server and create a new case regarding it")
        .addUserOption((option) => option.setName("user").setDescription("The user to be banned").setRequired(true))
        .addStringOption((option) =>
            option.setName("reason").setDescription("The reason on why the user was banned").setRequired(true),
        )
        .addAttachmentOption((option) =>
            option
                .setName("proof")
                .setDescription("An media containing proof to prove the reason valid")
                .setRequired(false),
        ),
    async Callback(interaction, client) {
        if (!interaction.member.permissions.has("BanMembers"))
            return await interaction.editReply({
                content: "You do not have permission to ban users from this server.",
            });

        const User = interaction.options.getUser("user", true);
        const Reason = interaction.options.getString("reason", true);
        const AttachmentProof = interaction.options.getAttachment("proof", false);
        const GuildUser = await interaction.guild.members.fetch(User).catch(() => null);
        const GuildSchema = (await client.Database.guild.findUnique({ where: { GuildId: interaction.guildId } }))!;

        if (User.id == interaction.user.id)
            return await interaction.reply({ content: "You can't ban yourself!", ephemeral: true });
        if (User.bot)
            return await interaction.reply({ content: "You can't ban bots! (do it manually)", ephemeral: true });
        if (
            !GuildUser ||
            !GuildUser.moderatable ||
            GuildUser.roles.highest.position >= interaction.member.roles.highest.position
        )
            return interaction.reply({
                content: "You (or the bot) can't moderate this user due to lack of permission/hierachy.",
                ephemeral: true,
            });

        await client.Database.guild.update({
            where: { GuildId: interaction.guildId },
            data: { CurrentCaseId: GuildSchema.CurrentCaseId + 1 },
        });
        const CaseResult = await client.Database.moderationCase.create({
            data: {
                CaseId: GuildSchema.CurrentCaseId + 1,
                Action: ModerationAction.Ban,
                TargetUserId: User.id,
                ModeratorUserId: interaction.user.id,
                GuildId: interaction.guildId,
                Reason: Reason,
                AttachmentProof: AttachmentProof ? AttachmentProof.url : "",
            },
        });
        await interaction.guild.members.ban(User, {
            reason: `Case ${CaseResult.CaseId} by ${interaction.user.username} (${interaction.user.id}): ${Reason}`,
        });

        const LogEmbed = new MeteoriumEmbedBuilder(undefined, interaction.user)
            .setAuthor({
                name: `Case: #${CaseResult.CaseId} | ban | ${User.username}`,
                iconURL: User.displayAvatarURL({ extension: "png" }),
            })
            .addFields(
                { name: "User", value: `<@${User.id}>` },
                {
                    name: "Moderator",
                    value: `<@${interaction.user.id}>`,
                },
                { name: "Reason", value: Reason },
            )
            .setImage(AttachmentProof ? AttachmentProof.url : null)
            .setFooter({ text: `Id: ${User.id}` })
            .setTimestamp()
            .setColor("Red");

        const PublicModLogChannel = await interaction.guild.channels
            .fetch(GuildSchema.PublicModLogChannelId)
            .catch(() => null);
        if (PublicModLogChannel != null && PublicModLogChannel.isTextBased())
            await PublicModLogChannel.send({ embeds: [LogEmbed] });

        return await interaction.reply({
            content:
                PublicModLogChannel != null && PublicModLogChannel.isTextBased()
                    ? undefined
                    : "(Warning: could not send log message to the public mod log channel)",
            embeds: [LogEmbed],
            ephemeral: GuildSchema?.PublicModLogChannelId != "",
        });
    },
};
