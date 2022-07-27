'use strict'

require('dotenv').config()

const { Client, Intents } = require('discord.js');
const { ReactionRole } = require("discordjs-reaction-role");

const roles = require('./roles.json');

const client = new Client({
	partials: [
		"CHANNEL",
		"MESSAGE",
		"REACTION",
	],
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_TYPING
	]
});
const roleManager = new ReactionRole(client, roles);

const isSecurity = (message) => message.member.roles.cache.some(
	(role) => role.name === 'security'
);

const state = {
	client,
	roleManager,
	isSecurity,
};

const triggers = {
	interactionCreate: require('./triggers/interaction/index.js')
};

for (const [key, item] of Object.entries(triggers)) {
	client.on(key, (...args) => item(state, ...args));
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageReactionAdd', (reaction, user) => {
	console.log(reaction, user);
});

client.login(process.env.DISCORD_BOT_TOKEN);
