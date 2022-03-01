require('dotenv').config()

const {
	Client,
	Intents
} = require('discord.js');
const MySQL = require('mysql2');

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
const database = MySQL.createConnection({
	host: process.env.MYSQL_HOST,
	port: process.env.MYSQL_PORT,
	database: process.env.MYSQL_NAME,
	user: process.env.MYSQL_USERNAME,
	password: process.env.MYSQL_PASSWORD
});

const triggers = {
	MessageCreate: require('./message/index.js'),
	InteractionCreate: require('./interaction/index.js')
};

const state = {
	client,
	database
};

for (const [key, item] of Object.entries(triggers)) {
	triggers[key] = (...args) => item(state, ...args);
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', triggers.MessageCreate);
client.on('interactionCreate', triggers.InteractionCreate);

client.login(process.env.DISCORD_TOKEN);