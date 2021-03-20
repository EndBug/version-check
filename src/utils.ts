import { Toolkit } from 'actions-toolkit'
import { getInputs } from './io'

export const tools = new Toolkit({ event: ['push'] })

export const inputs = getInputs()

export function readLocalJson(filePath: string) {
  try {
    const data = tools.readFile(filePath)
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
