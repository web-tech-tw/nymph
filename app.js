require('dotenv').config()

const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [
	Intents.FLAGS.GUILDS,
	Intents.FLAGS.GUILD_MESSAGES,
	Intents.FLAGS.DIRECT_MESSAGES
] });

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', (message) => {
	if (message.author.bot) return false; 
	
	console.log(`Message from ${message.author.username}: ${message.content}`);
	message.author.send("Hi")
})

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === 'ping') {
		await interaction.reply('Pong!');
	}
});

client.login(process.env.DISCORD_TOKEN);
