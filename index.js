// index.js — version complète avec système keepalive pour Render

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Le bot est vivant !'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Serveur web actif sur le port ${process.env.PORT || 3000}`);
});

const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  Events, PermissionsBitField, ChannelType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const AUTHORIZED_IDS = ['1049036099839852644', '1090024413841330236', '991295146215882872'];
const fiches = require('./fiches');
const membres = require('./membres');
const autresGroupes = require('./autresGroupes');

client.once(Events.ClientReady, () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: '5 Mayans ☠️', type: 3 }]
  });
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const args = message.content.trim().split(/\s+/);

  if (message.content.startsWith('!say')) {
    const toSay = message.content.slice(4).trim();
    if (!toSay) return;
    await message.delete().catch(() => {});
    return message.channel.send({ embeds: [new EmbedBuilder().setDescription(toSay).setColor(0x5865F2)] });
  }

  if (message.content === '!ticket') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('🎟️ Ouvrir un ticket').setStyle(ButtonStyle.Primary)
    );
    return message.channel.send({
      embeds: [new EmbedBuilder().setTitle('🎫 Créer un ticket').setDescription('Appuyez sur le bouton ci-dessous pour créer un ticket.').setColor(0x5865F2)],
      components: [row]
    });
  }

  if (message.content === '!dossier') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dossier_membre').setLabel('👤 Mayans').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('dossier_autres').setLabel('👥 Autre Groupe').setStyle(ButtonStyle.Secondary)
    );
    return message.channel.send({
      embeds: [new EmbedBuilder().setTitle('📁 Système de Dossier').setDescription('Choisissez une catégorie.').setColor(0x5865F2)],
      components: [row]
    });
  }

  if (!AUTHORIZED_IDS.includes(message.author.id)) return;

  if (message.content === '!help') {
    const embed = new EmbedBuilder()
      .setTitle('🛠️ Commandes disponibles')
      .setColor(0x5865F2)
      .setDescription(`
        \`!help\` – Affiche cette aide
        \`!say <message>\` – Envoie un message via le bot
        \`!ticket\` – Affiche le bouton de ticket
        \`!dossier\` – Affiche les boutons des fiches
        \`!close\` – Ferme un ticket
        \`!delete\` – Supprime un ticket
        \`!rename <nom>\` – Renomme un salon ticket
        \`!clear <nombre>\` – Supprime un nombre de messages`);
    return message.channel.send({ embeds: [embed] });
  }

  if (message.content === '!close') {
    if (!message.channel.name.startsWith('ticket-')) return;
    const userId = message.channel.topic;
    if (!userId) return message.channel.send({ embeds: [new EmbedBuilder().setDescription('❌ Auteur du ticket introuvable.').setColor(0xED4245)] });
    await message.channel.permissionOverwrites.edit(userId, { SendMessages: false });
    return message.channel.send({ embeds: [new EmbedBuilder().setDescription('🔒 Ticket fermé.').setColor(0xED4245)] });
  }

  if (message.content === '!delete') {
    if (!message.channel.name.startsWith('ticket-')) return;
    await message.channel.send({ embeds: [new EmbedBuilder().setDescription('⛔ Ticket supprimé.').setColor(0xED4245)] });
    return message.channel.delete().catch(console.error);
  }

  if (message.content.startsWith('!rename')) {
    const name = args.slice(1).join('-');
    if (!name) return message.channel.send({ embeds: [new EmbedBuilder().setDescription('❗ Nom requis.').setColor(0xED4245)] });
    await message.channel.setName(`ticket-${name}`);
    return message.channel.send({ embeds: [new EmbedBuilder().setDescription(`✅ Salon renommé en \`ticket-${name}\``).setColor(0x57F287)] });
  }

  if (message.content.startsWith('!clear')) {
    const amount = parseInt(args[1]);
    if (!amount || amount <= 0 || amount > 100) return message.reply({ embeds: [new EmbedBuilder().setDescription('❌ Nombre entre 1 et 100 requis.').setColor(0xED4245)] });
    await message.delete().catch(() => {});
    await message.channel.bulkDelete(amount, true);
    return message.channel.send({ embeds: [new EmbedBuilder().setDescription(`🧹 ${amount} messages supprimés.`).setColor(0x57F287)] });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const existing = interaction.guild.channels.cache.find(c => c.topic === interaction.user.id);
    if (existing) return interaction.reply({ content: '❗ Vous avez déjà un ticket.', ephemeral: true });

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      topic: interaction.user.id,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    await channel.send({ embeds: [new EmbedBuilder().setDescription(`🎟️ Ticket ouvert par ${interaction.user}`).setColor(0x2ECC71)] });
    return interaction.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
  }

  if (interaction.customId === 'dossier_membre') {
    const groupNames = Object.keys(membres);
    const rows = [];
    for (let i = 0; i < groupNames.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(
        groupNames.slice(i, i + 5).map(group =>
          new ButtonBuilder().setCustomId(`dossier_membre:${group}`).setLabel(group).setStyle(ButtonStyle.Primary)
        )
      ));
    }
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle('📁 Mayans').setDescription('Choisissez un groupe :').setColor(0x5865F2)],
      components: rows,
      ephemeral: true
    });
  }

  if (interaction.customId === 'dossier_autres') {
    const buttons = Object.keys(autresGroupes).map(group =>
      new ButtonBuilder().setCustomId(`dossier_membre:${group}`).setLabel(group).setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle('📁 Autres groupes').setDescription('Choisissez un groupe :').setColor(0x5865F2)],
      components: [new ActionRowBuilder().addComponents(buttons.slice(0, 5))],
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith('dossier_membre:')) {
    const group = interaction.customId.split(':')[1];
    const list = membres[group] || autresGroupes[group];
    if (!list) return interaction.reply({ content: '❌ Groupe inconnu.', ephemeral: true });
    const buttons = list.map(name =>
      new ButtonBuilder().setCustomId(`fiche:${name}`).setLabel(name).setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle(`👥 Membres – ${group}`).setDescription('Cliquez sur un nom.').setColor(0x5865F2)],
      components: [new ActionRowBuilder().addComponents(buttons.slice(0, 5))],
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith('fiche:')) {
    const name = interaction.customId.split(':')[1];
    const fiche = fiches[name];
    if (!fiche) return interaction.reply({ content: '❌ Fiche introuvable.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle(`📄 Fiche de ${fiche.nom}`)
      .setDescription(`**Prénom :** ${fiche.prenom}
**Âge :** ${fiche.age}
**Cheveux :** ${fiche.cheveux}
**Yeux :** ${fiche.yeux}
**Téléphone :** ${fiche.numero}
**Braquages :** ${fiche.braquages}
**Ventes :** ${fiche.ventes}
**Avertissements :** ${fiche.avertissements}`)
      .setColor(0x5865F2);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env['TOKEN']);
