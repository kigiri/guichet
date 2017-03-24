const w = _ => (console.log(_), _)

// MANAGE_CHANNELS
const discord = require('discord.js')
const config = require('./config')
const makeQueue = require('./queue')
const bot = new discord.Client()
const queue = Object.create(null)
const findChannel = name => channel => channel.type === 'voice'
  && channel.name.trim().toLowerCase() === channelName

const loadChannels = guild => (channelName = `file d'attente`, liveName = 'live') => {
    const channel = guild.channels.filterArray(findChannel(channelName))[0]
    const live = guild.channels.filterArray(findChannel(liveName))[0]

    const q = queue[guild.id] || (queue[guild.id] = makeQueue(guild))

    channel && 
    if (!channel || !live) {
      queue[guild.id].setChannel(channel)
      return false
    }    
  })
}

bot.login(config.botToken)
  .then(() => bot.guilds.forEach(guild => loadChannels(guild)))
  .then(() => console.log(`Connected to ${Object.keys(queue).length} channels`))
  .catch(console.error)

const actions = {
  list: q => q.list(),
  live: (q, ...name) => q.loadLive(name.join(' ')),
  wait: (q, ...name) => q.loadWait(name.join(' ')),
  start: q => q.start(),
  stop: q => q.stop(),
  ban: (q, user, ...reason) => {
    reason = reason.join(' ') || 'aucune raison'
    const id = user.indexOf('<@')
      ? ''
      : user.slice(2, -1)

    q.ban(id, reason)
    return `<@${id}> bannis pour ${reason}`
  },
}

const help = `${Object.keys(actions).join(', ')}`

bot.on('message', message => {
  const { content, channel } = message
  const q = queue[channel.guild.id]
  if (!q || content.indexOf('!live ')) return
  const [ , actionKey, ...args ] = content.trim().split(' ').filter(Boolean)
  const action = actions[actionKey]
  if (!action) return message.reply(`\`${actionKey}\` est inconnue, ${help}`)
  message.reply(action(q, ...args))
})

bot.on('voiceStateUpdate', ({ guild, user }) => {
  const q = queue[guild.id]
  if (!q || !q.isStarted()) return

  //if (!q.members[user.id]) return q.join(user)
    //.then(() => ws.register(q.members[user.id]))

  if (q.channels.live.members.has(user.id)) return q.ban(user.id, 'live')

  const method = q.channels.wait.members.has(user.id) ? 'join' : 'leave'
  q[method](user)//.then(() => ws[method](user.id))
})
