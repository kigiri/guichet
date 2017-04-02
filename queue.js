const mz = require('izi/mz')
const oops = require('izi/oops')
const f = require('izi/flow')
const formatDate = require('izi/date')('h:mm:ss')
const map = require('izi/collection/map')
const filter = require('izi/collection/filter')
const each = require('izi/collection/each')
const reduce = require('izi/collection/reduce')
const { resolve } = require('path')
const { writeFile, readFile, readdir } = mz('fs')
const { mkdirp } = mz('mkdirp')
const encoding = 'ascii'
const writeOpts = { encoding, flag: 'a' }
const ENOENT = oops('ENOENT')

const logAndDie = err => {
  console.error(err)
  //setTimeout(process.exit(1),
}

const storeChanges = (base, members, type) => id => {
  const ts = Date.now()
  if (members[id]) {
    members[id].logs.push({ type, ts })
  }

  return writeFile(`${base}/${id}`, `${type}${ts}\n`, writeOpts)
    .catch(logAndDie)
}

const toFileLog = ({ type, ts }) => `${type}${ts}`
const mergeLogs = logs => logs
  .map(toFileLog)
  .join('\n')

const parseLines = map(l => ({ ts: Number(l.slice(1)), type: l[0] }))
const calcTime = reduce((acc, { type, ts }) => {
  if (type === '+') {
    if (!acc.start) return { start: ts }
    if (acc.stop) return {
      offtime: (ts - acc.stop) + (acc.offtime || 0),
      start: acc.start,
    }
    return acc
  }

  if (!acc.stop) return { offtime: acc.offtime, start: acc.start, stop: ts }

  return acc
})

const byTimestamp = (a, b) => b.ts - a.ts
const doubleRecords = ({ type }, i, all) => i
  ? all[i - 1].type !== type
  : type === '+'

const getTotalWait = ({ offtime = 0, start = Date.now() }) =>
  Date.now() - (start + offtime)

const parseFile = file => parseLines(file.split('\n'))

module.exports = guild => {
  const base = resolve(`db/${guild.id}`)
  const serverInfo = `${base}/info.json`
  const members = Object.create(null)
  const blacklist = {}
  const channels = {}
  const add = storeChanges(base, members, '+')
  const remove = storeChanges(base, members, '-')
  let isStarted

  const ban = (id, reason) => {
    if (blacklist[id]) return blacklist[id]
    blacklist[id] = { reason, ts: Date.now() }

    // possible optimisation : queue changes and batch the save
    writeFile(serverInfo, JSON.stringify({
      blacklist,
      wait: channels.wait && channels.wait.id,
      live: channels.live && channels.live.id,
    }), 'utf8')
      .catch(logAndDie)

    return blacklist[id]
  }

  const registerUser = user => {
    user.user && (user = user.user)
    if (members[user.id]) return add(user.id)
    const m = members[user.id] = {
      id: user.id,
      logs: [ { type: '+', ts: Date.now() } ],
      name: user.username,
      code: user.discriminator,
      avatar: user.avatar,
    }

    return readFile(`${base}/${user.id}`, 'ascii')
      .then(parseFile)
      .then(logs => m.logs = m.logs
        .concat(logs)
        .sort(byTimestamp)
        .filter(doubleRecords))
      .catch(ENOENT.ignore)
      .then(() => writeFile(`${base}/${user.id}`, mergeLogs(m.logs), encoding))
  }

  const load = mkdirp(base)
    .then(() => readdir(base))
    .then(userFiles => userFiles
      .filter(id => !members[id] && /^[0-9]+$/.test(id))
      .forEach(remove))
    .then(() => readFile(serverInfo, 'utf8'))
    .then(JSON.parse)
    .then(info => {
      channels.wait = guild.channels.get(info.wait)
      channels.live = guild.channels.get(info.live)
      return info.blacklist
    })
    .then(each((id, banInfo) => blacklist[id] = banInfo))
    .catch(ENOENT.ignore)
    .catch(logAndDie)

  const loadChannel = (type, name) => {
    channels[type] = (name[0] === '#')
      ? guild.channels.findKey('position', Number(name.slice(1)))
      : guild.channels.filterArray(channel => channel.type === 'voice'
          && channel.name.trim().toLowerCase() === name)[0]
        || guild.channels.findKey('position', Number(name))

    return channels[type]
      ? `${channels[type].name} defini comme ${type} channel`
      : `${name} n'est pas dans la liste des channels`
  }

  const $ = {
    load,
    guild,
    channels,
    members,
    blacklist,
    loadWait: name => loadChannel('wait', name),
    loadLive: name => loadChannel('live', name),
    list: f.pipe([
      () => members,
      filter(u => !blacklist[u.id] && channel.wait.members.has(u.id)),
      map.toArr(u => ({ id: u.id, ts: getTotalWait(calcTime(u.logs)) })),
      r => r.sort(byTimestamp),
      map(({ id, ts }, index) =>
        `#${index + 1} <@${id}> depuis ${formatDate(new Date(ts))}`),
      r => r.join('\n'),
      r => `Prochain au guichet:\n${r}`,
    ]),
    isStarted: () => isStarted,
    stop: () => {
      channel.wait.members.forEach($.leave)
      isStarted = false
    },
    start: () => {
      isStarted = true
      if (!channels.wait) Promise.resolve('Il faut specifier la liste des channels avec la commande')
      return Promise.all(channel.wait.members.map(registerUser))
    },
    ban: (id, reason) => {
      remove(id)
      ban(id, reason)
    },
    join: user => isStarted && registerUser(user),
    leave: user => isStarted && remove(user.id),
  }

  return $
}