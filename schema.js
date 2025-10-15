const Hyperschema = require('hyperschema')
const HyperdbBuilder = require('hyperdb/builder')
const Hyperdispatch = require('hyperdispatch')

const NAMESPACE = 'ministudio'

const SCHEMA_DIR = './spec/schema'
const DB_DIR = './spec/db'
const EVENT_DIR = './spec/event'
const DISPATCH_DIR = './spec/dispatch'

const hyperSchema = Hyperschema.from(SCHEMA_DIR)
const schema = hyperSchema.namespace(NAMESPACE)
schema.register({
  name: 'writers',
  fields: [
    { name: 'key', type: 'buffer', required: true }
  ]
})
schema.register({
  name: 'invites',
  fields: [
    { name: 'id', type: 'buffer', required: true },
    { name: 'invite', type: 'buffer', required: true },
    { name: 'publicKey', type: 'buffer', required: true },
    { name: 'expires', type: 'int', required: true }
  ]
})
schema.register({
  name: 'users',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'videos',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'type', type: 'string', required: true },
    { name: 'blob', type: 'json', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'messages',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'text', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})
schema.register({
  name: 'events',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'data', type: 'json' }
  ]
})
Hyperschema.toDisk(hyperSchema)

const hyperdb = HyperdbBuilder.from(SCHEMA_DIR, DB_DIR)
const db = hyperdb.namespace(NAMESPACE)
db.collections.register({
  name: 'writers',
  schema: `@${NAMESPACE}/writers`,
  key: ['key']
})
db.collections.register({
  name: 'invites',
  schema: `@${NAMESPACE}/invites`,
  key: ['id']
})
db.collections.register({
  name: 'users',
  schema: `@${NAMESPACE}/users`,
  key: ['id']
})
db.collections.register({
  name: 'videos',
  schema: `@${NAMESPACE}/videos`,
  key: ['id']
})
db.collections.register({
  name: 'messages',
  schema: `@${NAMESPACE}/messages`,
  key: ['id']
})
HyperdbBuilder.toDisk(hyperdb)

const eventHyperdb = HyperdbBuilder.from(SCHEMA_DIR, EVENT_DIR)
const eventDb = eventHyperdb.namespace(NAMESPACE)
eventDb.collections.register({
  name: 'events',
  schema: `@${NAMESPACE}/events`,
  key: ['id']
})
HyperdbBuilder.toDisk(eventHyperdb)

const dispatch = Hyperdispatch.from(SCHEMA_DIR, DISPATCH_DIR, { offset: 0 })
const multiWriterDispatch = dispatch.namespace(NAMESPACE)
multiWriterDispatch.register({ name: 'add-writer', requestType: `@${NAMESPACE}/writers` })
multiWriterDispatch.register({ name: 'add-invite', requestType: `@${NAMESPACE}/invites` })
multiWriterDispatch.register({ name: 'del-invite', requestType: `@${NAMESPACE}/invites` })
multiWriterDispatch.register({ name: 'add-user', requestType: `@${NAMESPACE}/users` })
multiWriterDispatch.register({ name: 'del-user', requestType: `@${NAMESPACE}/users` })
multiWriterDispatch.register({ name: 'add-video', requestType: `@${NAMESPACE}/videos` })
multiWriterDispatch.register({ name: 'del-video', requestType: `@${NAMESPACE}/videos` })
multiWriterDispatch.register({ name: 'add-message', requestType: `@${NAMESPACE}/messages` })
multiWriterDispatch.register({ name: 'del-message', requestType: `@${NAMESPACE}/messages` })
multiWriterDispatch.register({ name: 'add-event', requestType: `@${NAMESPACE}/events` })
multiWriterDispatch.register({ name: 'del-event', requestType: `@${NAMESPACE}/events` })
Hyperdispatch.toDisk(dispatch)
