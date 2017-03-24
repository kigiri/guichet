const mz = require('izi/mz')
const oops = require('izi/oops')
const map = require('izi/collection/map')
const each = require('izi/collection/each')
const reduce = require('izi/collection/reduce')
const { resolve } = require('path')
const { writeFile, readFile, readdir } = mz('fs')
const { mkdirp } = mz('mkdirp')
const encoding = 'ascii'
const writeOpts = { encoding, flag: 'a' }
const ENOENT = oops('ENOENT')

const logAndDie = err => {
  console.error('error while storing user state change', err)
  exit(1)
}

const storeChanges = (base, members, type) => id => {
  const ts = Date.now()
  members[id].logs.push({ type, ts })

  return writeFile(`${base}/${id}`, `${type}${ts}\n`, writeOpts)
    .then(logAndDie)
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

const byTimestamp = (a, b) => a.ts - b.ts
const doubleRecords = ({ type }, i, all) => i
  ? all[i - 1].type !== type
  : type === '+'

const getTotalWait = ({ offtime = 0, start = Date.now() }) =>
  Date.now() - (start + offtime)

const parseFile = file => parseLines(file.split('\n'))

module.exports = (guild, channel) => {
  const base = resolve(`db/${guild.id}/${channel.id}`)
  const blacklistFile = `${base}/blacklist.json`
  const members = Object.create(null)
  const blacklist = Object.create(null)
  const add = storeChanges(base, members, '+')
  const remove = storeChanges(base, members, '-')

  const ban = (id, reason) => {
    if (blacklist[id]) return blacklist[id]
    blacklist[id] = { reason, ts: Date.now() }

    // possible optimisation : queue changes and batch the save
    writeFile(blacklistFile, JSON.parse(blacklist))
      .catch(logAndDie)

    return blacklist[id]
  }

  const registerUser = user => {
    user.user && (user = user.user)
    const m = members[user.id] = {
      id: user.id,
      logs: [ { type: '+', ts: Date.now() } ],
      name: user.username,
      code: user.discriminator,
      avatar: user.avatar,
    }

    return readFile(`${base}/${user.id}`, encoding)
      .then(parseFile)
      .then(logs => m.logs = m.logs
        .concat(logs)
        .sort(byTimestamp)
        .filter(doubleRecords))
      .catch(ENOENT.ignore)
      .then(() => writeFile(mergeLogs(m.logs), encoding))
  }

  const load = mkdirp(base)
    .then(() => Promise.all([ readdir(base) ]
      .concat(channel.members.map(registerUser))))
    .then(([ userFiles ]) => userFiles
      .filter(id => !members[id])
      .forEach(remove))
    .then(() => readFile(blacklistFile))
    .then(JSON.parse)
    .then(each((id, banInfo) => blacklist[id] = banInfo))
    .catch(ENOENT.ignore)
    .catch(logAndDie)

  return {
    load,
    guild,
    channel,
    members,
    blacklist,
    ban: (user, reason) => ban(user.id, reason),
    join: user => members[user.id] ? add(user.id) : registerUser(user),
    leave: user => remove(user.id),
  }
}