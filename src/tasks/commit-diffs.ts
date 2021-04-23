import semverDiff from 'semver-diff'
import { inputs, Outputs } from '../io'
import { tools } from '../utils'

export async function checkPushedCommitDiffs(): Promise<Outputs> {
  const { payload } = tools.context
  tools.log.debug(`Current payload: ${JSON.stringify(payload, null, 2)}`)

  const { before, after } = payload?.event || {}
  if (!before || !after)
    throw `Can't locate before & after SHAs:\n- before: ${before}\n- after: ${after}`
  tools.log.info(`Compare refs:\n- before: ${before}\n- after: ${after}`)

  // // https://docs.github.com/en/rest/reference/repos#compare-two-commits
  // const response = await tools.github.repos.compareCommits({
  //   ...tools.context.repo,
  //   base: before,
  //   head: after
  // })
  // if (!response?.data?.files)
  //   throw ("Cant't retrieve commit compare data from GitHub.")

  // const packageEntry = response.data.files.find(
  //   (file) =>
  //     file.filename == inputs.packageFileName && file.status == 'modified'
  // )

  tools.log.start('Request package files...')
  const files = await Promise.all([
    getCommitPackageFile(before),
    getCommitPackageFile(after)
  ])
  if (!files || typeof files != 'object')
    throw `Couldn't get package file from GitHub API.\nAPI error: ${files}`
  tools.log.success('Package files received.')

  const [vBefore, vAfter] = files.map((file) => file?.version)
  if (!vBefore) throw `Couldn't find version field in previous package file.`
  if (!vAfter) throw `Couldn't find version field in current package file.`
  tools.log.info(`Detected versions:\n- before: ${vBefore}\n- after: ${vAfter}`)

  if (vBefore == vAfter) {
    tools.log.info('No change detected.')
    return { changed: false }
  }

  tools.log.info('Change detected, identifying type...')
  const type = semverDiff(vBefore, vAfter),
    base: Outputs = {
      changed: true,
      previous_version: vBefore,
      current_version: vAfter
    }
  if (!type) {
    tools.log.info('Trying to indentify downgrade...')
    const reverseType = semverDiff(vAfter, vBefore)
    return {
      ...base,
      type: reverseType ? `downgrade > ${reverseType}` : undefined
    }
  } else return { ...base, type }
}

async function getCommitPackageFile(ref: string) {
  const rawFile = (
    await tools.github.repos
      .getContent({
        ...tools.context.repo,
        ref,
        path: inputs.packageFileName
      })
      .catch((r) => {
        throw `Couldn't get package file from GitHub API.\nRef: ${ref}\nAPI error: ${r}`
      })
  )?.data?.content

  if (!rawFile || typeof rawFile != 'string')
    throw `Couldn't get package file from GitHub API.\nRef: ${ref}`

  try {
    return JSON.parse(rawFile)
  } catch {
    throw `Couldn't parse package file to JSON. Ref: ${ref}`
  }
}
