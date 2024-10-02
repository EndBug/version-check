# Version check

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-21-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

You can use this GitHub action to check whether your npm package version has been updated: this can be extremely helpful if you want to automate your release process.

The main difference between this action and many others out there is that this doesn't do a specific task (it doesn't publish to registries, create tags or releases, send notifications, ...) but instead gives you an output that you can use in other steps of your workflow as you prefer: this way you don't have to deal with stuff you don't care about ;)

This action is heavily inspired by [`npm-publish-action`](https://github.com/pascalgn/npm-publish-action) by [pascal](https://github.com/pascalgn): if you only care about publishing your package to npm automatically, this is the simplest solution :thumbsup:

## Usage

### GitHub Workflow

You have to set up a step like this in your workflow (this assumes you've already [checked out](https://github.com/actions/checkout) your repo and [set up Node](https://github.com/actions/setup-node)):

```yaml
- id: check # This will be the reference for getting the outputs.
  uses: EndBug/version-check@v2 # You can choose the version/branch you prefer.

  with:
    # All these parameters are optional,
    # check their descriptions to see if you need them.

    # Whether to search in every commit's diff.
    # This is useful if you often do change the version without saying it in the
    # commit message. If you always include the semver of the new version in your
    # commit message when you bump versions then you can omit this.
    # Default: false
    diff-search: true

    # You can use this to indicate a custom path to your `package.json`. If you keep
    # your package file in the root directory (which is the usual approach) you can
    # omit this.
    # Default: package.json
    file-name: ./your/own/dir/someName.json

    # You can put your bearer GitHub token here. This is needed only when running
    # the action on private repostiories, if you're running it on a public repo you
    # can omit this.
    # If you need to set this, you can use the built-in `GITHUB_TOKEN` secret that
    # GitHub generates for your repo's actions: you can find more info about it here:
    # https://help.github.com/en/github/automating-your-workflow-with-github-actions/virtual-environments-for-github-actions#github_token-secret
    # Default: ''
    token: ${{ secrets.GITHUB_TOKEN }}

    # You can use this to make the action use an URL to get the package file,
    # instead of using the one in your repo.
    # Please note that the action will expect the version from that package file to
    # be the same as the one that has been added in the commit: if you want to
    # change this behavior take a look at the `assume-same-version` option.
    # You can also set this to '::before', and the action will use the file from
    # before the push event.
    # Default: ''
    file-url: https://unpkg.com/pkg/package.json

    # You can use this to make the action use the current version (either from the
    # local file or the provided URL, see the `file-url` option) as either the added
    # or deleted version.
    # Accepted values are 'new' (if you want that version to be the "added" one) and
    # 'old' (to make it the "deleted" one).
    # Default: ''
    assume-same-version: old

    # You can use this option to make the action check the local version against the
    # remote one (from the provided URL, see the `file-url` option).
    # Accepted values are 'localIsNew' (if you expect the local version to be newer
    # than the remote one) and `remoteIsNew`.
    # Please note that using the wrong value may make the action detect the change
    # but fail to identify the type.
    # Default: ''
    static-checking: localIsNew

    # If you are using an instance of GitHub Enterprise you can use this option to
    # change the location of your GitHub api url.
    # Default: 'https://api.github.com'
    github-api-url: https://git.contoso.com/api/v3
```

Now, when someone changes the version in `package.json` to `1.2.3` and pushes a commit with the message `<WHATEVER> 1.2.3` (eg. `Release 1.2.3` or `Bump version to v1.2.3`), output values are set (see Outputs below).

Please note that even if the action is built to be easier as possible to use, it is still subject to GitHub API's limits. That means that pushes and PRs that have a lot of commits may not show 100% of the commits. It is not something to worry about though, since the action has always worked in most of the cases ;)

### Outputs

- `changed`: either "true" or "false", indicates whether the version has changed.
- `type`: if the version has changed, it tries to find the type of bump (e.g. "patch", "minor", ...). To see the full list of available types, please refer to the [`semver-diff` docs](https://github.com/sindresorhus/semver-diff/blob/1f2ac09e19213122094b9c49c7ac9bf4089da93b/readme.md)
- `version`: if the version has changed, it shows the version number (e.g. "1.0.2")
- `commit`: if the version has changed, it shows the sha of the commit where the change has been found.

To access these outputs, you need to access the context of the step you previously set up: you can find more info about steps contexts [here](https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions#steps-context).
If you set your step id to `check` you'll find the outputs at `steps.check.outputs.OUTPUT_NAME`: you can use these outputs as conditions for other steps.
Here's an example:

```yaml
- name: Check if version has been updated
  id: check
  uses: EndBug/version-check@v2

- name: Log when changed
  if: steps.check.outputs.changed == 'true'
  run: 'echo "Version change found in commit ${{ steps.check.outputs.commit }}! New version: ${{ steps.check.outputs.version }} (${{ steps.check.outputs.type }})"'

- name: Log when unchanged
  if: steps.check.outputs.changed == 'false'
  run: 'echo "No version change :/"'
```

Please keep in mind that when the `static-checking` option is used the `commit` output is not given.

## Examples

### Publishing automatically to both NPM & GitHub Package Registry

If you want to see how to publish automatically your package to both NPM & GPR, please see [this](doc/auto-publish-example.yml) example workflow ;)
You can also find a more in-depth guide in this [here](doc/auto-publish-walkthrough.md).

### Static-checking with your latest version on NPM

If you want to check whether the version has changed since your last published version on NPM, you can do it using `file-url` and `static-checking`:

- `file-url`: you need to use something like a raw.githubusercontent.com or unpkg.com URL, an API that will give you a JSON response with your package file.
- `static-checking`: you're expecting your last published version to be older than the one in your repo, so we'll use `localIsNew`

```yaml
- id: check
  uses: EndBug/version-check@v2
  with:
    file-url: https://unpkg.com/your-package@latest/package.json
    static-checking: localIsNew
```

This step will have a `true` `changed` output every time our version is newer (there won't be any `commit` output).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/EndBug"><img src="https://avatars1.githubusercontent.com/u/26386270?v=4?s=100" width="100px;" alt="Federico Grandi"/><br /><sub><b>Federico Grandi</b></sub></a><br /><a href="#code-EndBug" title="Code">💻</a> <a href="#doc-EndBug" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://blog.zwezdin.com/"><img src="https://avatars2.githubusercontent.com/u/800755?v=4?s=100" width="100px;" alt="Sergey Zwezdin"/><br /><sub><b>Sergey Zwezdin</b></sub></a><br /><a href="#ideas-sergeyzwezdin" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/larskinn"><img src="https://avatars1.githubusercontent.com/u/910569?v=4?s=100" width="100px;" alt="Lars Kinn Ekroll"/><br /><sub><b>Lars Kinn Ekroll</b></sub></a><br /><a href="#bug-larskinn" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.hsalazar.xyz"><img src="https://avatars1.githubusercontent.com/u/4967271?v=4?s=100" width="100px;" alt="Humberto"/><br /><sub><b>Humberto</b></sub></a><br /><a href="#code-hsalazr" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hmehta"><img src="https://avatars3.githubusercontent.com/u/108334?v=4?s=100" width="100px;" alt="Heikki Mehtänen"/><br /><sub><b>Heikki Mehtänen</b></sub></a><br /><a href="#code-hmehta" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/CJY0208"><img src="https://avatars1.githubusercontent.com/u/18415774?v=4?s=100" width="100px;" alt="CJY"/><br /><sub><b>CJY</b></sub></a><br /><a href="#ideas-CJY0208" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/wasabigeek"><img src="https://avatars2.githubusercontent.com/u/4256705?v=4?s=100" width="100px;" alt="Nicholas"/><br /><sub><b>Nicholas</b></sub></a><br /><a href="#ideas-wasabigeek" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://alextorres.me"><img src="https://avatars0.githubusercontent.com/u/2911626?v=4?s=100" width="100px;" alt="Alex Torres"/><br /><sub><b>Alex Torres</b></sub></a><br /><a href="#code-AlexRex" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.adamkudrna.cz"><img src="https://avatars2.githubusercontent.com/u/5614085?v=4?s=100" width="100px;" alt="Adam Kudrna"/><br /><sub><b>Adam Kudrna</b></sub></a><br /><a href="#ideas-adamkudrna" title="Ideas, Planning, & Feedback">🤔</a> <a href="#doc-adamkudrna" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ludik.xyz/music"><img src="https://avatars0.githubusercontent.com/u/12783208?v=4?s=100" width="100px;" alt="spinlud"/><br /><sub><b>spinlud</b></sub></a><br /><a href="#bug-spinlud" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/JasonCubic"><img src="https://avatars.githubusercontent.com/u/8921015?v=4?s=100" width="100px;" alt="JasonCubic"/><br /><sub><b>JasonCubic</b></sub></a><br /><a href="#code-JasonCubic" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gerritbirkeland.com"><img src="https://avatars.githubusercontent.com/u/19329837?v=4?s=100" width="100px;" alt="Gerrit Birkeland"/><br /><sub><b>Gerrit Birkeland</b></sub></a><br /><a href="#code-Gerrit0" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Hirse"><img src="https://avatars.githubusercontent.com/u/2564094?v=4?s=100" width="100px;" alt="Jan Pilzer"/><br /><sub><b>Jan Pilzer</b></sub></a><br /><a href="#doc-Hirse" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://jacknumber.fr"><img src="https://avatars.githubusercontent.com/u/2306550?v=4?s=100" width="100px;" alt="Antoine Cadoret"/><br /><sub><b>Antoine Cadoret</b></sub></a><br /><a href="#doc-JackNUMBER" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kusyka911"><img src="https://avatars.githubusercontent.com/u/24293461?v=4?s=100" width="100px;" alt="Vladislav"/><br /><sub><b>Vladislav</b></sub></a><br /><a href="#code-kusyka911" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/SwabianCoder"><img src="https://avatars.githubusercontent.com/u/43047586?v=4?s=100" width="100px;" alt="SwabianCoder"/><br /><sub><b>SwabianCoder</b></sub></a><br /><a href="#bug-SwabianCoder" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://zachcardoza.com"><img src="https://avatars.githubusercontent.com/u/2280384?v=4?s=100" width="100px;" alt="Zach Cardoza"/><br /><sub><b>Zach Cardoza</b></sub></a><br /><a href="#bug-bayssmekanique" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/HarelM"><img src="https://avatars.githubusercontent.com/u/3269297?v=4?s=100" width="100px;" alt="Harel M"/><br /><sub><b>Harel M</b></sub></a><br /><a href="#doc-HarelM" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/leandro-melo-8b17021ba/"><img src="https://avatars.githubusercontent.com/u/72796924?v=4?s=100" width="100px;" alt="Leandro Melo"/><br /><sub><b>Leandro Melo</b></sub></a><br /><a href="#maintenance-Tpleme" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://mrkpatchaa.com"><img src="https://avatars.githubusercontent.com/u/1266755?v=4?s=100" width="100px;" alt="Médédé Raymond KPATCHAA"/><br /><sub><b>Médédé Raymond KPATCHAA</b></sub></a><br /><a href="#bug-mrkpatchaa" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/christulin"><img src="https://avatars.githubusercontent.com/u/47799223?v=4?s=100" width="100px;" alt="Chris Tulin"/><br /><sub><b>Chris Tulin</b></sub></a><br /><a href="#code-christulin" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## License

This action is distributed under the MIT license, check the [license](LICENSE) for more info.
