import { Toolkit } from 'actions-toolkit'
import fs from 'fs'
import path from 'path'

export const tools = new Toolkit({ event: ['push'] })

export function readLocalJson(localFilePath: string) {
  try {
    const filePath = path.join(tools.workspace, localFilePath)
    tools.log.debug(`[readLocalJson] Reading file: ${filePath}`)

    const data = fs.readFileSync(filePath, { encoding: 'utf-8' })
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
