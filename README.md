# Version check

You can use this GitHub action to check whether your npm package version has been updated: this can be extremely helpful if you want to automate your release process.  
The main difference between this action and many others out there is that this doesn't do a specific task (it doesn't publish to registries, create tags or releases, send notifications, ...) but instead gives you an output that you can use in other steps of your workflow as you prefer: this way you don't have to deal with stuff you don't care about ;)

This action is heavily inspired by [`npm-publish-action`](https://github.com/pascalgn/npm-publish-action) by [pascal](https://github.com/pascalgn): if you only care about publishing your package to npm automatically, this is the simplest solution :thumbsup:  

## Usage

You have to set up a step like this in your workflow (this assumes you've already [checked out](https://github.com/actions/checkout) your repo and [set up Node](https://github.com/actions/setup-node)):

```yaml
- id: check # This will be the reference for getting the outputs.
  uses: EndBug/version-check@v1 # You can choose the version/branch you prefer.
  
  with: # All these parameters are optional, check their descriptions to see if you need them.

    # Whether to search in every commit's diff. 
    # This is useful if you often do change the version manually without including it in the title. If you only use `npm version` to bump versions then you can omit this.
    # Default: false
    diff-search: true

    # You can use this to indicate a custom path to your `package.json`. If you keep your package file in the root directory (as every normal person would do) you can omit this.
    # Default: package.json
    file-name: ./your/own/dir/someName.json

    # You can put your bearer GitHub token here. This is needed only when running the action on private repostiories, if you're running it on a public repo you can omit this.
    # If you need to set this, you can use the built-in `GITHUB_TOKEN` secret that GitHub generates for your repo's actions: you cna find more info about it here: https://help.github.com/en/github/automating-your-workflow-with-github-actions/virtual-environments-for-github-actions#github_token-secret
    # Default: ''
    token: ${{ secrets.GITHUB_TOKEN }}

    # You can use this to make the action use an URL to get the package file, instead of using the one in your repo. 
    # Please note that the action will expect the version from that package file to be the same as the one that has been added in the commit: if you want to change this behavior take a look at the `assume-same-version` option.
    # Default: ''
    file-url: https://unpkg.com/pkg/package.json

    # You can use this to make the action use the current version (either from the local file or the provided URL, see the `file-url` option) as either the added or deleted version.
    # Accepted values are 'new' (if you want that version to be the "added" one) and 'old' (to make it the "deleted" one).
    # Default: ''
    assume-same-version: old

    # You can use this option to make the action check the local version against the remote one (from the provided URL, see the `file-url` option).
    # Accepted values are 'localIsNew' (if you expect the local version to be newer than the remote one) and `remoteIsNew`.
    # Please note that using the wrong value may make the action detect the change but fail to identify the type.
    # Default: ''
    static-checking: localIsNew
```

Please note that even if the action is built to be easier as possible to use, it is still subject to GitHub API's limits. That means that pushes and PRs that have a lot of commits may not show 100% of the commits. It is not something to worry about though, since the action has always worked in most of the cases ;)

### Outputs

- `changed` : either "true" or "false", indicates whether the version has changed.
- `type` : if the version has changed, it tries to find the type of bump (e.g. "patch", "minor", ...)
- `version` : if the version has changed, it shows the version number (e.g. "1.0.2")
- `commit` : if the version has changed, it shows the sha of the commit where the change has been found.

To access these outputs, you need to access the context of the step you previously set up: you can find more info about steps contexts [here](https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions#steps-context).  
If you set your step id to `check` you'll find the outputs at `steps.check.outputs.OUTPUT_NAME`: you can use these outputs as conditions for other steps.  
Here's an example:

```yaml
- name: Check if version has been updated
  id: check
  uses: EndBug/version-check@v1

- name: Log when changed
  if: steps.check.outputs.changed == 'true'
  run: 'echo "Version change found in commit ${{ steps.check.outputs.commit }}! New version: ${{ steps.check.outputs.version }} (${{ steps.check.outputs.type }})"'

- name: Log when unchanged
  if: steps.check.outputs.changed != 'true'
  run: 'echo "No version change :/"'
```

Please keep in mind that when the `static-checking` option is used the `commit` output is not given.

## Examples

### Publishing automatically to both NPM & GitHub Package Registry

If you want to see how to publish automatically your package to both NPM & GPR, please see [this](doc/auto-publish-example.yml) example workflow ;)  
You can also find a more in-depth guide in this [here](doc/auto-publish-walkthrough.md).

### Static-checking with your latest version on NPM

If you want to cehck whether the version has changed since your last published version on NPM, you can do it using `file-url` and `static-checking`:
- `file-url`: you need to use something like a raw.githubusercontent.com or unpkg.com URL, an API that will give you a JSON response with your package file.
- `static-checking`: you're expecting your last published version to be older than the one in your repo, so we'll use `localIsNew`

```yaml
- id: check
  uses: EndBug/version-check@v1
  with:
    file-url: https://unpkg.com/your-package@latest/package.json
    static-checking: localIsNew
```

This step will have a `true` `changed` output every time our version is newer (there won't be any `commit` output)

## Contributing

If you want to contribute to the action, even by just raising a problem or proposing an idea, you can click [here](CONTRIBUTING.md) to find out how to do it ;)

## License

This action is distributed under the MIT license, check the [license](LICENSE) for more info.
