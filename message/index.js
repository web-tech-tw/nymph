'use strict'

const simple_commands = {
	user_id: (_, message) => {
		message.channel.send(message.author.tag);
	},
	clear: async (_, message) => {
		const messages = await message.channel.messages.fetch();
		messages.forEach(async (item) => item.delete());
	},
	show_roles: (state, message) => {
		state.database.query(
			'SELECT * FROM `roles` WHERE `allow_assign` = TRUE',
			function (err, results) {
				if (err) {
					message.channel.send(JSON.stringify(err));
					return
				}
				message.channel.send(JSON.stringify(results));
			}
		);
	}
}

const direct_handler = require('./direct');
const guild_handler = require('./guild');

module.exports = (state, message) => {
	if (message.author.bot) return false;
	console.log(`Message from ${message.author.username}: ${message.content}`);
	if (message.content.startsWith('#')) {
		const command_key = message.content.substring(1);
		simple_commands[command_key](state, message);
	}
	if (message.guild === null) {
		direct_handler(state, message);
	} else {
		guild_handler(state, message);
	}
}