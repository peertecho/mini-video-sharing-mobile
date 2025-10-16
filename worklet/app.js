/* eslint-disable no-undef */
const process = require('process')
const fs = require('fs').promises
const path = require('path')
const goodbye = require('graceful-goodbye')
const { IPC } = BareKit

const MiniStudioRoom = require('./mini-studio-room')

/** @type {MiniStudioRoom | undefined} */
let room

process.on('uncaughtException', (err) => {
  write('error', `${err?.stack || err}`)
  IPC.end()
})
process.on('unhandledRejection', (err) => {
  write('error', `${err?.stack || err}`)
  IPC.end()
})

IPC.on('error', (err) => onError(err))
IPC.on('close', () => onClose())
IPC.on('data', async (data) => {
  const lines = data.toString().split('\n')
  for (let msg of lines) {
    msg = msg.trim()
    if (!msg) continue

    const obj = JSON.parse(msg)
    await onData(obj).catch(err => write('error', `${err?.stack || err}`))
  }
})

async function onError () {
  await room?.close()
}

async function onClose () {
  await room?.close()
}

async function onData (obj) {
  if (!obj.data?.noLog) write('log', obj)

  if (obj.tag === 'reset') {
    write('invite', undefined)
    const dir = path.join(obj.data, 'mini-studio')
    if (room) {
      await room.close()
      room = undefined
    }
    await fs.rm(dir, { recursive: true, force: true })
    write('invite', '')
    return
  }
  if (obj.tag === 'resume') {
    const storage = path.join(obj.data, 'mini-studio', 'storage')
    room = new MiniStudioRoom({ storage })
    goodbye(() => room.close())
    const shouldResume = await room.checkResume()
    if (shouldResume) {
      await room.ready()
      write('resumed', await room.createInvite())
    } else {
      write('resumed', '')
    }
    return
  }
  if (obj.tag === 'ready') {
    const { documentDir, invite } = obj.data
    if (!room) {
      const storage = path.join(documentDir, 'mini-studio', 'storage')
      room = new MiniStudioRoom({ storage, invite, write })
      goodbye(() => room.close())
    } else if (invite) {
      room.invite = invite
    }
    await room.ready()

    write('invite', room.invite || await room.createInvite())
    return
  }

  if (!room) {
    write('error', 'Room not found')
    return
  }
  await room.ready()

  if (obj.tag === 'get-videos') {
    write('videos', await room.getVideos())
    return
  }
  if (obj.tag === 'add-video') {
    await room.addVideo(randomId(), obj.data.name, obj.data.path, { at: new Date().toISOString() })
    return
  }
  if (obj.tag === 'get-messages') {
    write('messages', await room.getMessages())
    return
  }
  if (obj.tag === 'add-message') {
    await room.addMessage(randomId(), obj.data.text, { ...obj.data.info, at: new Date().toISOString() })
    return
  }
  write('error', `Unknown message: ${obj}`)
}

function randomId () {
  return Math.random().toString(16).slice(2)
}

function write (tag, data) {
  IPC.write(Buffer.from(JSON.stringify({ tag, data }) + '\n'))
}
