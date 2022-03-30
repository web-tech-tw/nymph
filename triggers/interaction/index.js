'use strict'

const commands = {
    "ping": (state, interaction) => {
        interaction.reply('Pong!');
    },
    "user_id": (state, interaction) => {
        interaction.reply(`${interaction.user.tag}\n\`${interaction.user.id}\``)
    },
    "clear": async (state, interaction) => {
        if (!state.isSecurity(interaction)) return;
        await interaction.reply("Received")
        const messages = await interaction.channel.messages.fetch();
        messages.forEach((item) => item.delete());
        const last_message = await interaction.channel.send('OK');
        setTimeout(() => last_message.delete(), 1000);
    },
}

module.exports = async (state, interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName in commands) {
        commands[interaction.commandName](state, interaction)
    }
}
