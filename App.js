/* eslint-disable no-undef, react/jsx-handler-names */
import { useState } from 'react'
import { Video } from 'expo-av'
import { StyleSheet, Text, View, TextInput, Button, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native'
import { setStringAsync } from 'expo-clipboard'
import { getDocumentAsync } from 'expo-document-picker'

import useWorklet from './hooks/use-workket'

export default function App () {
  const { ready, addVideo, addMessage, reset, clearError, invite, videos, messages, error } = useWorklet()

  const [mode, setMode] = useState('create')
  const [joinInvite, setJoinInvite] = useState('')
  const [input, setInput] = useState('')
  const [playerId, setPlayerId] = useState()

  const initializing = invite === undefined

  const onRoomCTA = () => {
    if (initializing) {
      alert('Still initializing, please try later')
      return
    }
    if (mode === 'join' && !joinInvite) {
      alert('Please type invite to join room')
      return
    }
    ready(mode === 'join' ? joinInvite : undefined)
  }

  const onReset = () => {
    reset()
  }

  const onAddFile = async () => {
    try {
      const result = await getDocumentAsync({ type: 'video/*' })
      for (const asset of result.assets) {
        addVideo({ name: asset.name, path: asset.uri.substring('file://'.length) })
      }
    } catch (err) {
      alert('Failed to pick a file')
    }
  }

  const onSend = (videoId) => {
    addMessage({ text: input, info: { videoId } })
    setInput('')
  }

  const renderSetupRoom = () => (
    <>
      {initializing && <Text style={styles.title}>Initializing...</Text>}
      <View style={styles.radioRow}>
        <TouchableOpacity style={styles.radioOption} onPress={() => setMode('create')}>
          <View style={[styles.radioCircle, mode === 'create' && styles.radioSelected]} />
          <Text>Create Room</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.radioOption} onPress={() => setMode('join')}>
          <View style={[styles.radioCircle, mode === 'join' && styles.radioSelected]} />
          <Text>Join Room</Text>
        </TouchableOpacity>
      </View>
      {mode === 'join' && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={joinInvite}
            onChangeText={val => setJoinInvite(val.trim())}
            placeholder='Type invite...'
          />
        </View>
      )}
      <Button
        title={mode === 'create' ? 'Create Room' : 'Join Room'}
        onPress={onRoomCTA}
      />
    </>
  )

  const renderStudioRoom = () => (
    <>
      <Text>Invite: {invite}</Text>
      <View style={styles.inviteActionRow}>
        <TouchableOpacity style={styles.copyButton} onPress={() => setStringAsync(invite)}>
          <Text style={styles.copyText}>Copy Invite</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={() => onReset()}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addFileButton} onPress={onAddFile}>
          <Text style={styles.addFileText}>Add Video</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.videosSection}>
        <Text style={styles.title}>Videos</Text>
        {videos.map((video) => {
          const comments = messages.filter(msg => msg.info.videoId === video.id)
          return (
            <View key={video.id}>
              <View style={styles.videoRow}>
                <Text style={styles.videoName}>{video.name}</Text>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => setPlayerId(playerId === video.id ? undefined : video.id)}
                >
                  <Text style={styles.playText}>{playerId === video.id ? 'Stop' : 'Play'}</Text>
                </TouchableOpacity>
              </View>
              {playerId === video.id && (
                <View style={styles.playerSection}>
                  <Video
                    source={{ uri: video.link }}
                    style={styles.videoPlayer}
                    useNativeControls
                    resizeMode="contain"
                    isLooping
                    shouldPlay
                  />
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={input}
                      onChangeText={setInput}
                      placeholder='Type your comment...'
                    />
                    <Button title='Send' onPress={() => onSend(video.id)} />
                  </View>
                  <Text style={styles.title}>Comments ({comments.length})</Text>
                  <ScrollView>
                    {comments.map((msg, idx) => (
                      <Text key={idx} style={styles.message}>{`${msg.text} ~ ${msg.info.at}`}</Text>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )
        })}
      </View>
    </>
  )

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {error && (
          <>
            <Text style={styles.title}>{error}</Text>
            <TouchableOpacity style={styles.resetButton} onPress={() => clearError()}>
              <Text style={styles.resetText}>Clear</Text>
            </TouchableOpacity>
          </>
        )}
        {invite ? renderStudioRoom() : renderSetupRoom()}
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: 16
  },
  radioRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#888',
    marginRight: 8,
    backgroundColor: '#fff'
  },
  radioSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 8
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginRight: 8
  },
  inviteActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  copyButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
  },
  copyText: {
    color: '#fff'
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'red',
    marginLeft: 8
  },
  resetText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12
  },
  message: {
    marginVertical: 2
  },
  videosSection: {
    alignSelf: 'stretch',
    marginBottom: 16
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  videoName: {
    flex: 1,
    fontSize: 16
  },
  playButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 4,
    paddingHorizontal: 12
  },
  playText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  playerSection: {
    marginBottom: 16
  },
  videoPlayer: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    marginBottom: 8
  },
  addFileButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#34C759',
    marginLeft: 8
  },
  addFileText: {
    color: '#fff',
    fontWeight: 'bold'
  }
})
