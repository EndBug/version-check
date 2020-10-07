import { getInput, setFailed, info, error, warning, setOutput } from '@actions/core'
import axios from 'axios'
import { readFileSync } from 'fs'
import { join, normalize } from 'path'
import semverDiff from 'semver-diff'
import semverRegex from 'semver-regex'

const packageFileName = normalize(getInput('file-name') || 'package.json'),
  dir = process.env.GITHUB_WORKSPACE || '/github/workspace',
  eventFile = process.env.GITHUB_EVENT_PATH || '/github/workflow/event.json',
  assumeSameVersion = getInput('assume-same-version') as 'old' | 'new' | undefined,
  staticChecking = getInput('static-checking') as 'localIsNew' | 'remoteIsNew' | undefined,
  token = getInput('token')

let packageFileURL = (getInput('file-url') || '').trim()
const allowedTags = ['::before']

type outputKey = 'changed' | 'type' | 'version' | 'commit'

// #region Functions
async function main() {
  if (packageFileURL && (!isURL(packageFileURL) && !allowedTags.includes(packageFileURL))) return setFailed(`The provided package file URL is not valid (received: ${packageFileURL})`)
  if (assumeSameVersion && !['old', 'new'].includes(assumeSameVersion)) return setFailed(`The provided assume-same-version parameter is not valid (received ${assumeSameVersion})`)
  if (staticChecking && !['localIsNew', 'remoteIsNew'].includes(staticChecking)) return setFailed(`The provided static-checking parameter is not valid (received ${staticChecking})`)

  if (packageFileURL == '::before') {
    const event = await readJson(eventFile)
    if (!event) throw new Error(`Can't find event file (${eventFile})`)

    const { before, repository } = event
    if (before && repository) {
      packageFileURL = `https://raw.githubusercontent.com/${repository?.full_name}/${before}/${packageFileName}`
      info('::group::URL tag resolution...')
      info(`::before tag resolved to ${repository?.full_name}/${String(before).substr(0, 7)}/${packageFileName}`)
      info(`Current package file URL: ${packageFileURL}`)
      info(`Using token for remote url: ${!!token}`)
      info('::endgroup::')
    } else
      throw new Error(`Can't correctly read event file (before: ${before}, repository: ${repository})`)
  }

  if (staticChecking) {
    if (!packageFileURL) return setFailed('Static checking cannot be performed without a `file-url` argument.')

    info('::group::Static-checking files...')
    info(`Package file name: "${packageFileName}"`)
    info(`Package file URL: "${packageFileURL}"`)
    const local: string = (await readJson(join(dir, packageFileName)))?.version,
      remote: string = (await readJson(packageFileURL, token))?.version
    if (!local || !remote) {
      info('::endgroup::')
      return setFailed(`Couldn't find ${local ? 'local' : 'remote'} version.`)
    }

    if ((local.match(semverRegex()) || [])[0] != (remote.match(semverRegex()) || [])[0]) {
      output('changed', true)
      output('version', staticChecking == 'localIsNew' ? local : remote)
      output('type', staticChecking == 'localIsNew' ? semverDiff(remote, local) : semverDiff(local, remote))

      info('::endgroup::')
      info(`Found match for version ${staticChecking == 'localIsNew' ? local : remote}`)
    }
  } else {
    const eventObj = await readJson(eventFile)
    const commits = eventObj.commits || await request(eventObj.pull_request._links.commits.href)
    return processDirectory(dir, commits)
  }
}

function isURL(str: string) {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

async function readJson(file: string, token?: string) {
  if (isURL(file)) {
    const headers = token ? {
      Authorization: `Bearer ${token}`
    } : undefined
    const { data } = await axios.get(file, { headers })
    if (typeof data == 'string') try { return JSON.parse(data) } catch (e) { error(e instanceof Error ? (e.stack || e.message) : e + '') }
    if (typeof data == 'object') return data
  } else {
    const data = readFileSync(file, { encoding: 'utf8' })
    if (typeof data == 'string') try { return JSON.parse(data) } catch (e) { error(e instanceof Error ? (e.stack || e.message) : e + '') }
  }
}

async function request(url: string) {
  const headers = token ? {
    Authorization: `Bearer ${token}`
  } : undefined
  return (await axios.get(url, { headers })).data
}

async function processDirectory(dir: string, commits: LocalCommit[] | PartialCommitResponse[]) {
  try {
    const packageObj = await (packageFileURL ? readJson(packageFileURL) : readJson(join(dir, packageFileName))).catch(() => {
      Promise.reject(
        new NeutralExitError(`Package file not found: ${packageFileName}`)
      )
    })

    if (!isPackageObj(packageObj))
      throw new Error('Can\'t find version field')

    if (commits.length >= 20)
      warning('This workflow run topped the commit limit set by GitHub webhooks: that means that commits could not appear and that the run could not find the version change.')

    await checkCommits(commits, packageObj.version)
  } catch (e) {
    setFailed(`${e}`)
  }
}

async function checkCommits(commits: LocalCommit[] | PartialCommitResponse[], version: string) {
  try {
    info(`::group::Searching in ${commits.length} commit${commits.length == 1 ? '' : 's'}...`)
    info(`Package file name: "${packageFileName}"`)
    info(`Package file URL: ${packageFileURL ? `"${packageFileURL}"` : 'undefined'}`)
    info(`Version assumptions: ${assumeSameVersion ? `"${assumeSameVersion}"` : 'undefined'}`)
    for (const commit of commits) {
      const { message, sha } = getBasicInfo(commit)
      const match = message.match(semverRegex()) || []
      if (match.includes(version)) {
        if (await checkDiff(sha, version)) {
          info('::endgroup::')
          info(`Found match for version ${version}: ${sha.substring(0, 7)} ${message}`)
          return true
        }
      }
    }
    info('::endgroup::')

    if (getInput('diff-search')) {
      info('No standard npm version commit found, switching to diff search (this could take more time...)')

      if (!isLocalCommitArray(commits)) {
        commits = commits.sort((a, b) =>
          (new Date(b.commit.committer.date)).getTime() - (new Date(a.commit.committer.date)).getTime()
        )
      }

      info(`::group::Checking the diffs of ${commits.length} commit${commits.length == 1 ? '' : 's'}...`)
      for (const commit of commits) {
        const { message, sha } = getBasicInfo(commit)

        if (await checkDiff(sha, version)) {
          info('::endgroup::')
          info(`Found match for version ${version}: ${sha.substring(0, 7)} - ${message}`)
          return true
        }
      }
    }

    info('::endgroup::')
    info('No matching commit found.')
    return false
  } catch (e) {
    setFailed(`${e}`)
  }
}

function getBasicInfo(commit: LocalCommit | PartialCommitResponse) {
  let message: string,
    sha: string

  if (isLocalCommit(commit)) {
    message = commit.message
    sha = commit.id
  } else {
    message = commit.commit.message
    sha = commit.sha
  }

  return {
    message,
    sha
  }
}

async function checkDiff(sha: string, version: string) {
  try {
    const commit = await getCommit(sha)
    const pkg = commit.files.find(f => f.filename == packageFileName)
    if (!pkg) {
      info(`- ${sha.substr(0, 7)}: no changes to the package file`)
      return false
    }

    const versionLines: {
      added?: string
      deleted?: string
    } = {}

    const rawLines = pkg.patch.split('\n')
      .filter(line => line.includes('"version":') && ['+', '-'].includes(line[0]))
    if (rawLines.length > 2) {
      info(`- ${sha.substr(0, 7)}: too many version lines`)
      return false
    }

    for (const line of rawLines)
      versionLines[line.startsWith('+') ? 'added' : 'deleted'] = line
    if (!versionLines.added) {
      info(`- ${sha.substr(0, 7)}: no "+ version" line`)
      return false
    }

    const versions = {
      added: assumeSameVersion == 'new' ? version : parseVersionLine(versionLines.added),
      deleted: assumeSameVersion == 'old' ? version : !!versionLines.deleted && parseVersionLine(versionLines.deleted)
    }
    if (versions.added != version && !assumeSameVersion) {
      info(`- ${sha.substr(0, 7)}: added version doesn't match current one (added: "${versions.added}"; current: "${version}")`)
      return false
    }

    output('changed', true)
    output('version', version)
    if (versions.deleted)
      output('type', semverDiff(versions.deleted, versions.added as string))
    output('commit', commit.sha)

    info(`- ${sha.substr(0, 7)}: match found, more info below`)
    return true
  } catch (e) {
    error(`An error occurred in checkDiff:\n${e}`)
    throw new ExitError(1)
  }
}

async function getCommit(sha: string): Promise<CommitResponse> {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${sha}`
  return request(url)
}

function parseVersionLine(str: string) {
  return (str.split('"') || [])
    .map(s => matchVersion(s))
    .find(e => !!e)
}

function matchVersion(str: string): string {
  return (str.match(semverRegex()) || [])[0]
}

function output(name: outputKey, value?: string | boolean) {
  return setOutput(name, `${value}`)
}
// #endregion

// #region Error classes
class ExitError extends Error {
  code?: number

  constructor(code: number | null) {
    super(`Command failed with code ${code}`)
    if (typeof code == 'number') this.code = code
  }
}

class NeutralExitError extends Error { }
// #endregion

if (require.main == module) {
  info('Searching for version update...')
  main().catch(e => {
    if (e instanceof NeutralExitError) process.exitCode = 78
    else {
      process.exitCode = 1
      error(e.message || e)
    }
  })
}

// #region Types and interfaces
interface CommitResponse extends PartialCommitResponse {
  files: {
    filename: string
    additions: number
    deletions: number
    changes: number
    status: string
    raw_url: string
    blob_url: string
    patch: string
  }[]
}

interface LocalCommit {
  id: string
  message: string
  author: {
    name: string
    email: string
  }
  url: string
  distinct: boolean
}
function isLocalCommit(value): value is LocalCommit {
  return typeof value.id == 'string'
}
function isLocalCommitArray(value: any[]): value is LocalCommit[] {
  return isLocalCommit(value[0])
}

interface PackageObj {
  version: string
}
function isPackageObj(value): value is PackageObj {
  return !!value && !!value.version
}

interface PartialCommitResponse {
  url: string
  sha: string
  node_id: string
  html_url: string
  comments_url: string
  commit: {
    url: string
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
    message: string
    tree: {
      url: string
      sha: string
    }
    comment_count: number
    verification: {
      verified: boolean
      reason: string
      signature: object | null
      payload: object | null
    }
  }
  author: {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    receive_events_url: string
    type: string
    site_admin: boolean
  }
  committer: {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    receive_events_url: string
    type: string
    site_admin: boolean
  }
  parents: {
    url: string
    sha: string
  }[]
  stats: {
    additions: number
    deletions: number
    total: number
  }
}
// #endregion
