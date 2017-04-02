const http = require('http')
const tupac = require('../tupac/lib/tupac')
const initWeso = require('izi/weso-node')
const curry = require('izi/auto-curry')
const qs = require('querystring')
const { parse: parseUrl } = require('url')
const shared = require('./shared')
const config = require('./config')
const admins = new Set(config.admins.map(d => Buffer(JSON.stringify(d)).toString('base64')))

const send = curry((code, message, res) => {
  res.writeHead(code, { "Content-Type": "text/plain" })
  res.end(`${code} ${message}\n`)
})

const send401 = send(401, 'Access Denied')

tupac({
  weso: true,
  title: 'Guichet du RSA',
  before: [ (req, res) => {
    const url = parseUrl(req.url)
    if (url.pathname.indexOf('/admin') !== -1) {
      const session = weso.getOrInitSession(req, res, {})
      if (!session.isAdmin) {
        if (!admins.has(url.query)) return send401(res)
        weso.setSession(res, { isAdmin: true, id: session.id })
      }
    }
    next(res)
  } ],
}).then(server => {
  global.weso = initWeso({
    server,
    secret: config.secret,
    publish: shared.wesoServer,
    subscribe: shared.wesoClient,
    //secure: { key, cert },
  })

  weso.start(({ ws }) => {
    if (!ws.session.isAdmin) return
  })

  weso.stop(({ ws }) => {
    if (!ws.session.isAdmin) return
  })

  weso.next(({ ws }) => {
    if (!ws.session.isAdmin) return
  })

  weso.ban(({ ws }) => {
    if (!ws.session.isAdmin) return
  }) // (userId, reasonStr)

})

weso.uploadStart(uploadStart)
weso.uploadProgress(uploadProgress)
weso.uploadDone(uploadDone)
weso.fileChange(fileChange)