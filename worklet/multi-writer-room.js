/**
 * @typedef {{ db: HyperDB, event: HyperDB }} View
 * @typedef {function(string, function(any, { view: View, base: Autobase }))} RouterAdd
 */
const rrp = require('resolve-reject-promise')
const b4a = require('b4a')
const z32 = require('z32')
const ReadyResource = require('ready-resource')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const Autobase = require('autobase')
const HyperDB = require('hyperdb')
const BlindPairing = require('blind-pairing')

const MultiWriterDispatch = require('../spec/dispatch')
const MultiWriterDb = require('../spec/db')
const EventDb = require('../spec/event')

class MultiWriterRoom extends ReadyResource {
  constructor (opts = {}) {
    super()

    const storage = opts.storage || 'storage'
    this.storage = storage

    const bootstrap = opts.bootstrap
    this.bootstrap = bootstrap

    const store = opts.store || new Corestore(storage)
    this.store = store

    const swarm = opts.swarm || (() => {
      const swarm = new Hyperswarm({ bootstrap })
      swarm.on('connection', (conn) => store.replicate(conn))
      return swarm
    })()
    this.swarm = swarm

    this.dbNamespace = opts.dbNamespace || 'multiWriter'
    /** @type {{ add: RouterAdd }} */
    this.router = new MultiWriterDispatch.Router()
    this._addRouter()

    this.pairing = new BlindPairing(swarm)
    this.invite = opts.invite

    this.base = null
    this.baseLocal = null
    this.baseLocalKey = null
    this.pairMember = null
  }

  async checkResume() {
    await this.store.ready()

    const baseLocal = Autobase.getLocalCore(this.store)
    this.baseLocal = baseLocal
    await baseLocal.ready()
    this.baseLocalKey = baseLocal.key

    const baseLocalLength = baseLocal.length
    await baseLocal.close()

    return !!baseLocalLength
  }

  async _open () {
    const shouldResume = await this.checkResume()

    let key
    let encryptionKey
    if (!shouldResume && this.invite) {
      console.log('~ Joining')
      const res = await new Promise((resolve) => {
        this.pairing.addCandidate({
          invite: z32.decode(this.invite),
          userData: this.baseLocalKey,
          onadd: resolve
        })
      })
      key = res.key
      encryptionKey = res.encryptionKey
    }

    this.base = new Autobase(this.store, key, {
      encrypt: true,
      encryptionKey,
      open: this._openBase.bind(this),
      close: this._closeBase.bind(this),
      apply: this._applyBase.bind(this)
    })

    const writable = rrp()
    this.base.on('update', () => {
      if (this.base.writable) writable.resolve()
      if (!this.base._interrupting) this.emit('update')
    })
    await this.base.ready()
    this.swarm.join(this.base.discoveryKey)

    if (!this.base.writable) await writable.promise
    this.view.db.core.download({ start: 0, end: -1 })
    this.view.event.core.download({ start: 0, end: -1 })

    this.view.event.watch(() => this.emit('new-event'))

    this.pairMember = this.pairing.addMember({
      discoveryKey: this.base.discoveryKey,
      /** @type {function(import('blind-pairing-core').MemberRequest)} */
      onadd: async (request) => {
        const id = request.inviteId
        const inv = await this.view.db.findOne(`@${this.dbNamespace}/invites`, {})
        if (inv === null || !b4a.equals(inv.id, id)) {
          return
        }
        request.open(inv.publicKey)
        await this.addWriter(request.userData)
        request.confirm({
          key: this.base.key,
          encryptionKey: this.base.encryptionKey
        })
      }
    })
  }

  async _close () {
    await this.pairMember?.close()
    await this.baseLocal?.close()
    await this.base?.close()
    await this.pairing.close()
    await this.swarm.destroy()
    await this.store.close()
  }

  _openBase (store) {
    const db = HyperDB.bee(store.get('view'), MultiWriterDb, { extension: false, autoUpdate: true })
    const event = HyperDB.bee(store.get('event'), EventDb, { extension: false, autoUpdate: true })
    return { db, event }
  }

  async _closeBase (view) {
    await Promise.all([
      view.db.close(),
      view.event.close()
    ])
  }

  async _applyBase (nodes, view, base) {
    for (const node of nodes) {
      await this.router.dispatch(node.value, { view, base })
    }
    await view.db.flush()
    await view.event.flush()
  }

  _addRouter () {
    this.router.add(`@${this.dbNamespace}/add-writer`, async (data, context) => {
      await context.base.addWriter(data.key)
    })
    this.router.add(`@${this.dbNamespace}/add-invite`, async (data, context) => {
      await context.view.db.insert(`@${this.dbNamespace}/invites`, data)
    })
    this.router.add(`@${this.dbNamespace}/del-invite`, async (data, context) => {
      await context.view.db.delete(`@${this.dbNamespace}/invites`, { id: data.id })
    })
    this.router.add(`@${this.dbNamespace}/add-user`, async (data, context) => {
      await context.view.db.insert(`@${this.dbNamespace}/users`, data)
    })
    this.router.add(`@${this.dbNamespace}/del-user`, async (data, context) => {
      await context.view.db.delete(`@${this.dbNamespace}/users`, { id: data.id })
    })
    this.router.add(`@${this.dbNamespace}/add-event`, async (data, context) => {
      await context.view.event.insert(`@${this.dbNamespace}/events`, data)
    })
    this.router.add(`@${this.dbNamespace}/del-event`, async (data, context) => {
      await context.view.event.delete(`@${this.dbNamespace}/events`, { id: data.id })
    })
  }

  /** @type {View} */
  get view () {
    return this.base.view
  }

  async addWriter (key) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/add-writer`, { key: b4a.isBuffer(key) ? key : b4a.from(key) })
    )
  }

  async createInvite () {
    const existing = await this.view.db.findOne(`@${this.dbNamespace}/invites`, {})
    if (existing) {
      return z32.encode(existing.invite)
    }
    const { id, invite, publicKey, expires } = BlindPairing.createInvite(this.base.key)
    const record = { id, invite, publicKey, expires }
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/add-invite`, record)
    )
    return z32.encode(record.invite)
  }

  async deleteInvite () {
    const existing = await this.view.db.findOne(`@${this.dbNamespace}/invites`, {})
    if (existing) {
      await this.base.append(MultiWriterDispatch.encode(`@${this.dbNamespace}/del-invite`, existing))
    }
  }

  async getUsers () {
    return await this.view.db.find(`@${this.dbNamespace}/users`, {}).toArray()
  }

  async addUser (id, info) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/add-user`, { id, info })
    )
  }

  async delUser (id) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/del-user`, { id })
    )
  }

  async addEvent (id, data) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/add-event`, { id, data })
    )
  }

  async delEvent (id) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/del-event`, { id })
    )
  }

  async getEvents ({ reverse = true, limit = 100, gt, lt, gte, lte } = {}) {
    return await this.view.event.find(`@${this.dbNamespace}/events`, { reverse, limit, gt, lt, gte, lte }).toArray()
  }
}

module.exports = MultiWriterRoom
