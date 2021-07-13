import { Server, Client } from 'hyperspace'
import Hyperbee from 'hyperbee'
import pump from 'pump'
import concat from 'concat-stream'

let server
let client

export async function setup () {
  console.log('Initializing hyperspace server')
  server = new Server({
    storage: './.hyper',
    host: 'search-hyperspace'
  })
  await server.ready()
  console.log('Initializing hyperspace client')
  client = new Client({host: 'search-hyperspace'})
  console.log({ts: true}, 'Hyperspace ready')
}

export function create () {
  const bee = new Hyperbee(client.corestore().get(null), {
    keyEncoding: 'utf8',
    valueEncoding: 'json'
  })
  bee.list = async (opts) => {
    let stream = await bee.createReadStream(opts)
    return new Promise((resolve, reject) => {
      pump(
        stream,
        concat(resolve),
        err => {
          if (err) reject(err)
        }
      )
    })
  }
  return bee
}