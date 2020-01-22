import * as core from '@actions/core'
import axios from 'axios'
import { readFile } from 'fs'
import { join } from 'path'
import semverDiff from 'semver-diff'
import semverRegex from 'semver-regex'

const packageFileName = core.getInput('file-name') || 'package.json',
  dir = process.env.GITHUB_WORKSPACE || '/github/workspace',
  eventFile = process.env.GITHUB_EVENT_PATH || '/github/workflow/event.json',
  token = core.getInput('token')

type ArgValue<T> =
  T extends 'changed' ? boolean :
  T extends 'type' ? string | undefined :
  T extends 'version' ? string | undefined :
  never

async function main() {
  const eventObj = await readJson(eventFile)
  return await processDirectory(dir, eventObj.commits)
}

interface Commit {
  id: string
  message: string
  author: {
    name: string
    email: string
  }
  url: string
  distinct: boolean
}

interface PackageObj {
  version: string
}
function isPackageObj(value): value is PackageObj {
  return !!value && !!value.version
}

async function getCommit(sha: string): Promise<CommitResponse> {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${sha}`
  const headers = token ? {
    Authorization: `Bearer ${token}`
  } : undefined
  return (await axios.get(url, { headers })).data
}
interface CommitResponse {
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


async function checkCommits(commits: Commit[], version: string) {
  try {
    for (const commit of commits) {
      const match = commit.message.match(semverRegex()) || []
      if (match.includes(version)) {
        if (await checkDiff(commit.id, version)) {
          console.log(`Found match for version ${version}: ${commit.id.substring(0, 7)} ${commit.message}`)
          return true
        }
      }
    }

    if (core.getInput('diff-search')) {
      console.log('No standard npm version commit found, switching to diff search (this could take more time...)')

      for (const commit of commits) {
        if (await checkDiff(commit.id, version)) {
          console.log(`Found match for version ${version}: ${commit.id.substring(0, 7)} ${commit.message}`)
          return true
        }
      }
    }

    console.log('No matching commit found.')
    return false
  } catch (e) {
    core.setFailed(e)
  }
}

async function checkDiff(sha: string, version: string) {
  try {
    const commit = await getCommit(sha)
    const pkg = commit.files.find(f => f.filename == packageFileName)
    if (!pkg) return false

    const versionLines: {
      added?: string
      deleted?: string
    } = {}

    const rawLines = pkg.patch.split('\n')
      .filter(line => line.includes('"version":') && ['+', '-'].includes(line[0]))
    if (rawLines.length > 2) return false

    for (const line of rawLines)
      versionLines[line.startsWith('+') ? 'added' : 'deleted'] = line
    if (!versionLines.added) return false

    const versions = {
      added: matchVersion(versionLines.added),
      deleted: !!versionLines.deleted && matchVersion(versionLines.deleted)
    }
    if (versions.added != version) return false

    setOutput('changed', true)
    setOutput('version', version)
    if (versions.deleted)
      setOutput('type', semverDiff(versions.deleted, versions.added))
    return true
  } catch (e) {
    console.error(`An error occurred in checkDiff:\n${e}`)
    throw new ExitError(1)
  }
}

function matchVersion(str: string) {
  return ((str.match(/[0-9.]+/g) || [])
    .map(s => s.match(semverRegex()))
    .find(e => !!e) || [])[0]
}

async function processDirectory(dir: string, commits: Commit[]) {
  try {
    const packageFile = join(dir, packageFileName),
      packageObj = await readJson(packageFile).catch(() => {
        Promise.reject(
          new NeutralExitError(`Package file not found: ${packageFile}`)
        )
      })

    if (!isPackageObj(packageObj))
      throw new Error('Can\'t find version field')

    if (commits.length >= 20)
      console.warn('This workflow run topped the commit limit set by GitHub webhooks: that means that commits could not appear and that the run could not find the version change.')

    await checkCommits(commits, packageObj.version)
  } catch (e) {
    core.setFailed(e)
  }
}

async function readJson(file: string) {
  const data: string = await new Promise((resolve, reject) =>
    readFile(file, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  )
  return JSON.parse(data)
}

function setOutput<T extends 'changed' | 'type' | 'version'>(name: T, value: ArgValue<T>) {
  return core.setOutput(name, `${value}`)
}

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
  console.log('Searching for version update...')
  main().catch(e => {
    if (e instanceof NeutralExitError) process.exitCode = 78
    else {
      process.exitCode = 1
      console.error(e.message || e)
    }
  })
}
