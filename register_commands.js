'use strict'

require('dotenv').config()

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!'
  },
  {
    name: 'user_id',
    description: 'Replies with Pong!'
  },
  {
    name: 'clear',
    description: 'Replies with Pong!'
  }
];

const client = new REST({ version: '9' });
client.setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await client.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();