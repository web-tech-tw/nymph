require('dotenv').config()

const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [
	Intents.FLAGS.GUILDS,
	Intents.FLAGS.GUILD_MESSAGES,
	Intents.FLAGS.DIRECT_MESSAGES
] });

const triggers = {
	MessageCreate: require('./message/index.js'),
	InteractionCreate: require('./interaction/index.js')
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', triggers.MessageCreate);
client.on('interactionCreate', triggers.InteractionCreate);

client.login(process.env.DISCORD_TOKEN);
