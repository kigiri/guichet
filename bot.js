const w = _ => (console.log(_), _)

// MANAGE_CHANNELS
const discord = require('discord.js')
const config = require('./config')
const makeQueue = require('./queue')
const channelName = `file d'attente`
const bot = new discord.Client()
const queue = Object.create(null)
const findChannel = channel => channel.type === 'voice'
  && channel.name.trim().toLowerCase() === channelName

const loadChannels = () => {
  bot.guilds.forEach(guild => {
    const channel = guild.channels.filterArray(findChannel)[0]

    if (!channel) {
      delete queue[guild.id]
      return console.log(`Channel not found for guild ${guild.name}`)
    }
    queue[guild.id] || (queue[guild.id] = makeQueue(guild, channel))
    
    /*
    guild.createChannel(channelName, 'voice', {
      // permissions
    })
    */
  })
  console.log(`Connected to ${Object.keys(queue).length} channels`)
}

bot.login(config.botToken)
  .then(loadChannels)
  .catch(console.error)

bot.on('voiceStateUpdate', ({ guild, user }) => {
  const q = queue[guild.id]
  if (!q) return

  if (!q.members[user.id]) return q.join(user)
    .then(() => ws.register(q.members[user.id]))

  const method = q.channel.members.has(user.id) ? 'join' : 'leave'
  q[method](user).then(() => ws[method](user.id))
})
