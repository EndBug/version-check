import { Toolkit } from 'actions-toolkit'

export const tools = new Toolkit({ event: ['push'] })

export function readLocalJson(filePath: string) {
  try {
    const data = tools.readFile(filePath, 'utf-8')
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
