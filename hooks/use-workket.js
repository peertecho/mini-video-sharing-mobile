import b4a from 'b4a'
import { useState, useEffect } from 'react'
import { Worklet } from 'react-native-bare-kit'
import { Paths } from 'expo-file-system'

import bundle from '../worklet/app.bundle.mjs'

const worklet = new Worklet()
worklet.start('/app.bundle', bundle)
const { IPC } = worklet

const useWorklet = () => {
  const [invite, setInvite] = useState()
  const [videos, setVideos] = useState([])
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    IPC.on('data', (data) => {
      const lines = b4a.toString(data).split('\n')
      for (let msg of lines) {
        msg = msg.trim()
        if (!msg) continue

        const obj = JSON.parse(msg)
        if (obj.tag === 'resumed') {
          setInvite(obj.data)
        } else if (obj.tag === 'invite') {
          setInvite(obj.data)
        } else if (obj.tag === 'videos') {
          setVideos(obj.data)
        } else if (obj.tag === 'messages') {
          setMessages(obj.data)
        } else if (obj.tag === 'error') {
          setError(obj.data)
        } else if (obj.tag === 'log') {
          console.log(obj.data)
        }
      }
    })
    write('resume', Paths.document.uri.substring('file://'.length))
    return () => IPC.end()
  }, [])

  useEffect(() => {
    if (!invite) return

    const intervalGetVideos = setInterval(() => write('get-videos', { noLog: true }), 1000)
    const intervalGetMessages = setInterval(() => write('get-messages', { noLog: true }), 1000)
    return () => {
      clearInterval(intervalGetMessages)
      clearInterval(intervalGetVideos)
    }
  }, [invite])

  return {
    ready: (invite) => write('ready', { documentDir: Paths.document.uri.substring('file://'.length), invite }),
    addVideo: (filePath) => write('add-video', filePath),
    addMessage: (message) => write('add-message', message),
    reset: () => {
      write('reset', Paths.document.uri.substring('file://'.length))
      setVideos([])
    },
    clearError: () => setError(''),
    invite,
    videos,
    messages,
    error
  }
}

function write (tag, data) {
  IPC.write(b4a.from(JSON.stringify({ tag, data }) + '\n'))
}

export default useWorklet
