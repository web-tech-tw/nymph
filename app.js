'use strict'

require('dotenv').config()

const {
    Client,
    Partials,
    GatewayIntentBits,
    PresenceUpdateStatus,
    ActivityType,
} = require('discord.js');
const { ReactionRole } = require("discordjs-reaction-role");

const roles = require('./roles.json');

const client = new Client({
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
    ],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
    ],
});
const roleManager = new ReactionRole(client, roles);

const isSecurity = (message) => message.member.roles.cache.some(
	(role) => role.name === 'security'
);

const state = {
	client,
	roleManager,
	isSecurity,
};

const triggers = {
	interactionCreate: require('./triggers/interaction/index.js')
};

for (const [key, item] of Object.entries(triggers)) {
	client.on(key, (...args) => item(state, ...args));
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({
        status: PresenceUpdateStatus.Online,
        activities: [{
            type: ActivityType.Playing,
            name: "黑客帝國",
        }],
    });
});

client.on('messageReactionAdd', (reaction, user) => {
	console.log(reaction, user);
});

client.login(process.env.DISCORD_BOT_TOKEN);
