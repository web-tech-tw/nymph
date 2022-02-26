module.exports = (message) => {
	if (message.author.bot) return false;
	console.log(`Message from ${message.author.username}: ${message.content}`);
}
