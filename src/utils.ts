import { Toolkit } from 'actions-toolkit'
import path from 'path'

export const tools = new Toolkit({ event: ['push'] })

export function readLocalJson(localPath: string) {
  try {
    const data = tools.readFile(path.join(__dirname, localPath))
    if (typeof data == 'string') return JSON.parse(data)
  } catch (e) {
    return undefined
  }
}

export function startGroup(title: string) {
  console.log(`::group::${title}`)
}
export function endGroup() {
  console.log('::endgroup::')
}
