import { tools, readLocalJson, startGroup, endGroup } from './utils'

export interface Inputs {
  mode: 'commit_diff'
  packageFileName: string
}
function getInputs() {
  const res = {}
  startGroup('Inputs')
  const validators: Record<keyof Inputs, (v: string) => boolean> = {
    mode: (v) => ['commit_diff'].includes(v),
    packageFileName: (v) => !!readLocalJson(v)
  }
  const parsers: Partial<Record<keyof Inputs, (v: any) => any>> = {}

  tools.log.start('Validating inputs...')
  for (const key in validators) {
    const value = tools.inputs[key]
    if (!validators[key](value))
      throw tools.exit.failure(
        `Invalid ${key} input: ${value} (${typeof value})`
      )
    else res[key] = parsers[key] ? parsers[key](value) : value
  }

  tools.log.success('Validation complete.')
  tools.log.info('Current inputs:\n' + JSON.stringify(res, null, 2))
  endGroup()
  return res as Inputs
}
export const inputs = getInputs()

export interface Outputs {
  changed: boolean
  type?: string
  previous_version?: string
  current_version?: string
}
export function setOutputs(outputs: Partial<Outputs>, log = true) {
  const defaults: Outputs = {
    changed: false
  }

  if (log) {
    startGroup('Outputs:')
    tools.log.start('Setting outputs...')
  }
  Object.entries({ ...defaults, ...outputs }).forEach(([key, value]) => {
    let stringified: string

    try {
      stringified = JSON.stringify(value)
    } catch (e) {
      throw `Couldn't stringify output:\nKey: ${key}\nType: ${typeof value}\nValue: ${value}`
    }

    tools.outputs[key] = stringified
  })
  if (log) {
    tools.log.success('Outputs have been set.')
    tools.log.info(
      'Current outputs:\n' + JSON.stringify(tools.outputs, null, 2)
    )
    endGroup()
  }
}
