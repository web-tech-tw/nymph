const simple_commands = {
	user_id: (message) => {
		message.channel.send(message.author.tag)
	},
	clear: async (message) => {
		const messages = await message.channel.messages.fetch()
		messages.map((message) => message.delete())
	}
}

module.exports = (message) => {
	if (message.author.bot) return false;
	console.log(`Message from ${message.author.username}: ${message.content}`);
	if (message.content.startsWith('#')) {
		const command_key = message.content.substring(1)
		simple_commands[command_key](message)
	}
}