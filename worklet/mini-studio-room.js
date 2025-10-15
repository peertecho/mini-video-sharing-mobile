const fs = require('fs')
const path = require('path')
const idEnc = require('hypercore-id-encoding')
const getMimeType = require('get-mime-type')
const Hyperblobs = require('hyperblobs')
const BlobServer = require('hypercore-blob-server')

const MultiWriterDispatch = require('../spec/dispatch')
const MultiWriterRoom = require('./multi-writer-room')

class MiniStudioRoom extends MultiWriterRoom {
  constructor (opts = {}) {
    super({
      ...opts,
      dbNamespace: 'ministudio'
    })

    this.opts = opts
    this.blobs = null
    this.blobServer = null
  }

  async _open () {
    await super._open()

    let blobsCore
    if (!this.invite && !this.baseLocalLength) {
      blobsCore = this.store.get({ name: 'blobs' })
      await blobsCore.ready()
      this.addEvent('blobsCoreKey', idEnc.normalize(blobsCore.key))
    } else {
      const blobsCoreKey = await this._getBlobsCoreKey()
      blobsCore = this.store.get(idEnc.decode(blobsCoreKey))
      await blobsCore.ready()
    }
    this.swarm.join(blobsCore.discoveryKey)

    this.blobs = new Hyperblobs(blobsCore)
    await this.blobs.ready()

    this.blobServer = new BlobServer(this.store.session())
    await this.blobServer.listen()
  }

  async _close () {
    await this.blobServer.close()
    await this.blobs.close()
    await super._close()
  }

  _addRouter () {
    super._addRouter()

    this.router.add(`@${this.dbNamespace}/add-video`, async (data, context) => {
      await context.view.db.insert(`@${this.dbNamespace}/videos`, data)
    })
    this.router.add(`@${this.dbNamespace}/del-video`, async (data, context) => {
      await context.view.db.delete(`@${this.dbNamespace}/videos`, { id: data.id })
    })
    this.router.add(`@${this.dbNamespace}/add-message`, async (data, context) => {
      await context.view.db.insert(`@${this.dbNamespace}/messages`, data)
    })
    this.router.add(`@${this.dbNamespace}/del-message`, async (data, context) => {
      await context.view.db.delete(`@${this.dbNamespace}/messages`, { id: data.id })
    })
  }

  async _getBlobsCoreKey () {
    const events = await this.getEvents()
    const blobsCoreKey = events.find(item => item.id === 'blobsCoreKey')?.data
    if (blobsCoreKey) return blobsCoreKey

    await new Promise(resolve => setTimeout(resolve, 100))
    return _getBlobsCoreKey()
  }

  async getVideos ({ reverse = true, limit = 100 } = {}) {
    const videos = await this.view.db.find(`@${this.dbNamespace}/videos`, { reverse, limit }).toArray()
    return videos.map(item => {
      const link = this.blobServer.getLink(this.blobs.core.key, { blob: item.blob, type: item.type })
      return { ...item, link }
    })
  }

  async addVideo (id, name, filePath, info) {
    const type = getMimeType(name)
    if (!type || !type.startsWith('video/')) {
      this.opts.write('error', 'Only video files are allowed')
      return
    }

    const rs = fs.createReadStream(filePath)
    const ws = this.blobs.createWriteStream()
    await new Promise((resolve, reject) => {
      ws.on('error', reject)
      ws.on('close', resolve)
      rs.pipe(ws)
    })
    const blob = { key: this.blobs.core.key, ...ws.id }

    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/add-video`, { id, name, type, blob, info })
    )
  }

  async delVideo (id) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/del-video`, { id })
    )
  }

  async getMessages ({ reverse = true, limit = 100 } = {}) {
    return await this.view.db.find(`@${this.dbNamespace}/messages`, { reverse, limit }).toArray()
  }

  async addMessage (id, text, info) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/add-message`, { id, text, info })
    )
  }

  async delMessage (id) {
    await this.base.append(
      MultiWriterDispatch.encode(`@${this.dbNamespace}/del-message`, { id })
    )
  }
}

module.exports = MiniStudioRoom
