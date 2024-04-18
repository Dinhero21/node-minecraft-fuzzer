import { setTimeout as sleep } from 'timers/promises'
import { createClient } from 'minecraft-protocol'
import wait from 'wait-port'

interface ServerTabCompletePacketData {
  transactionId: number
  start: number
  length: number
  matches: Array<{
    match: string
    tooltip: string | undefined
  }>
}

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT) || 25565
const INTERVAL = Number(process.env.INTERVAL) || 100

const SLEEP = INTERVAL > 0

const OPTIONS = {
  host: HOST,
  port: PORT,
  username: 'Fuzzer'
}

await wait({
  host: HOST,
  port: PORT
})

while (true) {
  const client = createClient(OPTIONS)

  let transactionId = 0

  const texts = new Map<number, string>()

  const queue: string[] = []

  function complete (text: string): void {
    transactionId++

    client.write('tab_complete', {
      transactionId,
      text
    })

    texts.set(transactionId, text)
  }

  client.on('tab_complete', async (data: ServerTabCompletePacketData) => {
    const transactionId = data.transactionId

    const original = texts.get(transactionId)

    if (original === undefined) return

    const start = data.start

    const prefix = original.substring(0, start)

    for (const { match } of data.matches) {
      const text = `${prefix}${match}`

      if (text.startsWith('//')) continue
      if (text.includes('minecraft')) continue

      queue.push(text)
    }
  })

  await new Promise<void>(resolve => {
    client.once('login', () => {
      resolve()
    })
  })

  complete('/')

  while (!client.ended) {
    const text = queue.shift()

    if (text === undefined) {
      await sleep(100)

      continue
    }

    if (SLEEP) await sleep(INTERVAL)

    client.chat(text)

    complete(text)
    complete(text + ' ')
  }
}
