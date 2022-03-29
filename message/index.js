'use strict'

const direct_handler = require('./direct');
const guild_handler = require('./guild');

module.exports = (state, message) => {
	if (message.author.bot) return false;
	console.log(`Message from ${message.author.username}: ${message.content}`);
	state.simpleCommandExecutor = function (local_commands) {
		if (message.content.startsWith('#')) {
			const command_key = message.content.substring(1);
			if (command_key in local_commands) {
				local_commands[command_key](state, message);
				return true;
			}
		}
		return false;
	};
	if (state.simpleCommandExecutor({
		user_id: (_, message) => {
			message.channel.send(`${message.author.tag}\n\`${message.author.id}\``);
		},
	})) return;
	if (message.guild === null) {
		direct_handler(state, message);
	} else {
		guild_handler(state, message);
	}
}
