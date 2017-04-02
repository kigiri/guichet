const w = _ => (console.log(_), _)

// MANAGE_CHANNELS
const config = require('./config')
const discord = require('discord.js')
const makeQueue = require('./queue')
const bot = new discord.Client()
const queue = Object.create(null)

bot.login(config.botToken)
  .then(() => bot.guilds.forEach(guild =>  queue[guild.id] = makeQueue(guild)))
  .then(() => console.log(`Connected to ${Object.keys(queue).length} channels`))
  .then(() => {
    console.log(Object.getOwnPropertyNames(discord.Client.prototype))
  })
  .catch(console.error)

const actions = {
  list: q => q.list(),
  live: (q, ...name) => q.loadLive(name.join(' ')),
  wait: (q, ...name) => q.loadWait(name.join(' ')),
  info: q => q.getInfo(),
  start: q => (q.start(), "debut de la file d'attente"),
  stop: q => q.stop(),
  next: q => {

  },
  ban: (q, user, ...reason) => {
    reason = reason.join(' ') || 'aucune raison'
    const id = user.indexOf('<@')
      ? ''
      : user.slice(2, -1)

    q.ban(id, reason)
    return `<@${id}> bannis pour ${reason}`
  },
}

const help = `
  \`list\` - Montre la file d'attente
  \`live channel*\` - definie le channel a surveiller pour le live
  \`wait channel*\` - definie le channel a surveiller pour la file d'attente
  \`start\` - demarre la file d'attente
  \`stop\` - arrete la file d'attente
  \`ban @mention raison\` - bloque un utilisateur de la file d'attente (raison est optionnel)
  * _un channel peu etre indiquer par son nom \`Salle d'Attente\` ou ca position \`#3\`_`

bot.on('message', message => {
  if (message.author.id !== '143860662987128832') return
  const { content, channel } = message
  const q = queue[channel.guild.id]
  if (!q || content.indexOf('!live ')) return
  const [ , actionKey, ...args ] = content.trim().split(' ').filter(Boolean)
  const action = actions[actionKey]
  if (!action) return message.reply(`\`${actionKey}\` est inconnue, ${help}`)
  Promise.resolve(action(q, ...args))
    .then((msg) => message.reply(msg))
})

bot.on('voiceStateUpdate', ({ guild, user }) => {
  const q = queue[guild.id]
  console.log(user.username, 'status update')
  if (!q || !q.isStarted()) return console.log('no associated queue')

  //if (!q.members[user.id]) return q.join(user)
    //.then(() => ws.register(q.members[user.id]))

  if (q.channels.live.members.has(user.id)) return q.ban(user.id, 'live')

  const method = q.channels.wait.members.has(user.id) ? 'join' : 'leave'
  q[method](user)//.then(() => ws[method](user.id))
})
