"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const semver_diff_1 = __importDefault(require("semver-diff"));
const semver_regex_1 = __importDefault(require("semver-regex"));
const packageFileName = process.env.INPUT_FILE_NAME || 'package.json', dir = process.env.GITHUB_WORKSPACE || '/github/workspace', eventFile = process.env.GITHUB_EVENT_PATH || '/github/workflow/event.json';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const eventObj = yield readJson(eventFile);
        return yield processDirectory(dir, eventObj.commits);
    });
}
function isPackageObj(value) {
    return !!value && !!value.version;
}
function getCommit(sha) {
    return __awaiter(this, void 0, void 0, function* () {
        let url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${sha}`;
        return (yield axios_1.default.get(url)).data;
    });
}
function checkCommits(commits, version) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            for (let commit of commits) {
                let match = commit.message.match(semver_regex_1.default()) || [];
                if (match.includes(version)) {
                    console.log(commit);
                    if (yield checkDiff(commit.id, version)) {
                        console.log(`Found match for version ${version}: ${commit.id.substring(0, 7)} ${commit.message}`);
                        return true;
                    }
                }
            }
            if (process.env.INPUT_DIFF_SEARCH) {
                console.log('No standard npm version commit found, switching to diff search (this could take more time...)');
                for (let commit of commits) {
                    if (yield checkDiff(commit.id, version)) {
                        console.log(`Found match for version ${version}: ${commit.id.substring(0, 7)} ${commit.message}`);
                        return true;
                    }
                }
            }
            return false;
        }
        catch (e) {
            throw e;
        }
    });
}
function checkDiff(sha, version) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let commit = yield getCommit(sha);
            let pkg = commit.files.find(f => f.filename == packageFileName);
            if (!pkg)
                return false;
            let versionLines = {};
            let rawLines = pkg.patch.split('\n')
                .filter(line => line.includes('"version":') && ['+', '-'].includes(line[0]));
            if (rawLines.length > 2)
                return false;
            for (let line of rawLines)
                versionLines[line.startsWith('+') ? 'added' : 'deleted'] = line;
            if (!versionLines.added)
                return false;
            let versions = {
                added: (versionLines.added.match(semver_regex_1.default()) || [])[0],
                deleted: !!versionLines.deleted && (versionLines.deleted.match(semver_regex_1.default()) || [])[0]
            };
            if (versions.added != version)
                return false;
            setOutput('changed', true);
            if (versions.deleted)
                setOutput('type', semver_diff_1.default(versions.deleted, versions.added));
            return true;
        }
        catch (e) {
            console.error(`An error occured in checkDiff:\n${e}`);
            throw new ExitError(1);
        }
    });
}
function processDirectory(dir, commits) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const packageFile = path_1.join(dir, packageFileName), packageObj = yield readJson(packageFile).catch(() => {
                Promise.reject(new NeutralExitError(`Package file not found: ${packageFile}`));
            });
            if (!isPackageObj(packageObj))
                throw new Error('Can\'t find version field');
            if (commits.length >= 20)
                console.warn('This worflow run topped the commit limit set by GitHub webhooks: that means that commits could not appear and that the run could not find the version change.');
            yield checkCommits(commits, packageObj.version);
        }
        catch (e) {
            throw e;
        }
    });
}
function readJson(file) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield new Promise((resolve, reject) => fs_1.readFile(file, "utf8", (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        }));
        return JSON.parse(data);
    });
}
function setOutput(name, value) {
    return run(dir, 'echo', `::set-output name=${name}::${value}`);
}
function run(cwd, command, ...args) {
    console.log("Executing:", command, args.join(" "));
    return new Promise((resolve, reject) => {
        const proc = child_process_1.spawn(command, args, {
            cwd,
            stdio: ["ignore", "ignore", "pipe"]
        });
        const buffers = [];
        proc.stderr.on("data", data => buffers.push(data));
        proc.on("error", () => {
            reject(new Error(`command failed: ${command}`));
        });
        proc.on("exit", code => {
            if (code === 0) {
                resolve(true);
            }
            else {
                const stderr = Buffer.concat(buffers)
                    .toString("utf8")
                    .trim();
                if (stderr) {
                    console.log(`Command failed with code ${code}`);
                    console.log(stderr);
                }
                reject(new ExitError(code));
            }
        });
    });
}
// #region Error classes
class ExitError extends Error {
    constructor(code) {
        super(`Command failed with code ${code}`);
        if (typeof code == 'number')
            this.code = code;
    }
}
class NeutralExitError extends Error {
}
// #endregion
if (require.main == module) {
    console.log('Searching for version update...');
    main().catch(e => {
        if (e instanceof NeutralExitError)
            process.exitCode = 78;
        else {
            process.exitCode = 1;
            console.error(e.message || e);
        }
    });
}
