'use strict'

require('dotenv').config()

const {Client, Intents} = require('discord.js');

const client = new Client({
	partials: [
		"CHANNEL"
	],
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_TYPING
	]
});

const isSecurity = (message) => message.member.roles.cache.some(role => role.name === 'security');

const state = {client, isSecurity};

const triggers = {
	interactionCreate: require('./triggers/interaction/index.js')
};

for (const [key, item] of Object.entries(triggers)) {
	client.on(key, (...args) => item(state, ...args));
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
