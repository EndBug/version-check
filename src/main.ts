import { Outputs, setOutputs } from './io'
import { checkPushedCommitDiffs } from './tasks/commit-diffs'
import { endGroup, inputs, startGroup, tools } from './utils'

async function main() {
  let outputs: Partial<Outputs> | undefined
  const { event } = tools.context

  if (inputs.mode == 'commit_diff') {
    if (event != 'push')
      throw `The 'commit_diff' mode can be used only with the 'push' event (current event: ${event}).`

    startGroup('Task: check diff between pushed commits')
    outputs = await checkPushedCommitDiffs()
    tools.log.success('Task completed')
    endGroup()
  }

  setOutputs(outputs || {})
}
main().catch(tools.exit.failure)
