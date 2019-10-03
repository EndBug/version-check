import axios from 'axios'
import { spawn } from 'child_process'
import { readFile } from "fs";
import { join } from "path";
import semverDiff from 'semver-diff'
import semverRegex from 'semver-regex';

const packageFileName = process.env.INPUT_FILE_NAME || 'package.json',
  dir = process.env.GITHUB_WORKSPACE || '/github/workspace',
  eventFile = process.env.GITHUB_EVENT_PATH || '/github/workflow/event.json'

type ArgValue<T> =
  T extends 'changed' ? boolean :
  T extends 'type' ? string | undefined :
  never

async function main() {
  const eventObj = await readJson(eventFile)
  console.log(eventObj)
  return await processDirectory(dir, eventObj.commits)
}

interface Commit {
  sha: string
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

function getCommit(sha: string): Promise<CommitReponse> {
  return axios.get(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${sha}`)
}
interface CommitReponse {
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
    deleteions: number
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
    for (let commit of commits) {
      let match = commit.message.match(semverRegex()) || []
      if (match.includes(version)) {
        if (await checkDiff(commit.sha, version)) {
          console.log(`Found match for version ${version}: ${commit.sha.substring(0, 7)} ${commit.message}`)
          return true
        }
      }
    }

    if (process.env.INPUT_DIFF_SEARCH) {
      console.log('No standard npm version commit found, switching to diff search (this could take more time...)')

      for (let commit of commits) {
        if (await checkDiff(commit.sha, version)) {
          console.log(`Found match for version ${version}: ${commit.sha.substring(0, 7)} ${commit.message}`)
          return true
        }
      }
    }

    return false
  } catch (e) {
    throw e;
  }
}

async function checkDiff(sha: string, version: string) {
  try {
    let commit = await getCommit(sha)
    let pkg = commit.files.find(f => f.filename == packageFileName)
    if (!pkg) return false

    let versionLines: {
      added?: string
      deleted?: string
    } = {}

    let rawLines = pkg.patch.split('\n')
      .filter(line => line.includes('"version":') && ['+', '-'].includes(line[0]))
    if (rawLines.length > 2) return false

    for (let line of rawLines)
      versionLines[line.startsWith('+') ? 'added' : 'deleted'] = line
    if (!versionLines.added) return false

    let versions = {
      added: (versionLines.added.match(semverRegex()) || [])[0],
      deleted: !!versionLines.deleted && (versionLines.deleted.match(semverRegex()) || [])[0]
    }
    if (versions.added != version) return false

    setOutput('changed', true)
    if (versions.deleted)
      setOutput('type', semverDiff(versions.deleted, versions.added))
    return true
  } catch (e) {
    console.error(`An error occured in checkDiff:\n${e}`)
    throw new ExitError(1)
  }
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
      console.warn('This worflow run topped the commit limit set by GitHub webhooks: that means that commits could not appear and that the run could not find the version change.');

    await checkCommits(commits, packageObj.version)
  } catch (e) {
    throw e
  }
}

async function readJson(file: string) {
  const data: string = await new Promise((resolve, reject) =>
    readFile(file, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  );
  return JSON.parse(data);
}

function setOutput<T extends 'changed' | 'type'>(name: T, value: ArgValue<T>) {
  return run(dir, 'echo', `::set-output name=${name}::${value}`)
}

function run(cwd: string, command: string, ...args: string[]): Promise<true> {
  console.log("Executing:", command, args.join(" "))
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "ignore", "pipe"]
    })
    const buffers: any[] = []

    proc.stderr.on("data", data => buffers.push(data))

    proc.on("error", () => {
      reject(new Error(`command failed: ${command}`))
    })

    proc.on("exit", code => {
      if (code === 0) {
        resolve(true)
      } else {
        const stderr = Buffer.concat(buffers)
          .toString("utf8")
          .trim()

        if (stderr) {
          console.log(`Command failed with code ${code}`)
          console.log(stderr)
        }

        reject(new ExitError(code))
      }
    });
  });
}

// #region Error classes
class ExitError extends Error {
  code?: number

  constructor(code: number | null) {
    super(`Command failed with code ${code}`);
    if (typeof code == 'number') this.code = code;
  }
}

class NeutralExitError extends Error { }
// #endregion

if (require.main == module) {
  console.log('Searching for version update...')
  main().catch(e => {
    if (e instanceof NeutralExitError) process.exitCode = 78
    else {
      process.exitCode = 1;
      console.error(e.message || e)
    }
  })
}