const simple_commands = {
	user_id: (_, message) => {
		message.channel.send(message.author.tag)
	},
	clear: async (_, message) => {
		const messages = await message.channel.messages.fetch()
		messages.map((message) => message.delete())
	},
	abc: (_, message) => {
		message.channel.send("Hi")
	}
}

module.exports = (state, message) => {
	if (message.author.bot) return false;
	console.log(`Message from ${message.author.username}: ${message.content}`);
	if (message.content.startsWith('#')) {
		const command_key = message.content.substring(1)
		simple_commands[command_key](state, message)
	}
}