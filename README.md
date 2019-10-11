# Version check

You can use this GitHub action to check whether your npm package version has been updated: this can be extremely helpful if you want to automate your release process.  
The main difference between this action and many others out there is that this doesn't do a specific task (it doesn't publish to registries, create tags or releases, send notifications, ...) but instead gives you an output that you can use in other steps of your workflow as you prefer: this way you don't have to deal with stuff you don't care about ;)

This action is heavily inspired by [`npm-publish-action`](https://github.com/pascalgn/npm-publish-action) by [pascal](https://github.com/pascalgn): if you only care about publishing your package to npm automatically, this is the simplest solution :thumbsup:  

## Usage

You have to set up a step like this in your workflow (this assumes you've already [checked out](https://github.com/actions/checkout) your repo and [set up Node](https://github.com/actions/setup-node)):

```yaml
- name: Check if version has been updated # You can edit this
    id: check # This will be the reference for getting the outputs
    uses: EndBug/version-check@v1.0.0 # You can choose teh version/branch you prefer
    with: # You can find more info about inputs below
      file-name: package.json
      diff-search: true
```

### Inputs

- `file-name` (optional) : you can use this to indicate a custom path to your `package.json`; if you keep your package file in the root directory (as every normal person would do) you can omit this.
- `diff-search` (optional) : whether to search in every commit's diff. This is useful if you often do change the version manually without including it in the title: you can find more info on how the action detects the version change [here](doc/logic_chain.md). If you only use `npm version` to bump versions then you can omit this.

### Outputs

This action sets two outputs:

- `changed` : either "true" or "false", indicates whether the version has changed.
- `type` : if the version has changed, it tries to find the type of bump (e.g. "patch", "minor", ...)

To access these outputs, you need to access the context of the step you previously set up: you can find more info about steps contexts [here](https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions#steps-context).  
If you set your step id to `check` you'll find the outputs at `steps.check.outputs.changed` and `steps.check.outputs.type`: you can use these outputs as conditions for other steps.  
Here's an example:

```yaml
- name: Check if version has been updated
  id: check
  uses: EndBug/version-check@v1.0.0

- name: Log when changed
  if: steps.check.outputs.changed == 'true'
  run: 'echo "Version change! -> ${{ steps.check.outputs.type }}"'

- name: Log when unchanged
  if: steps.check.outputs.changed != 'true'
  run: 'echo "No version change :/"'
```

### Publishing automatically to both NPM & GitHub Package Registry

If you want to see how to publish automatically your package to both NPM & GPR, please see [this](doc/auto-publish-example.yml) example workflow ;)
You can also find a more in-depth guide in this [here](doc/auto-publish-walkthrough.md).

## Contributing

If you want to contribute to the action, even by just raising a problem or proposing an idea, you can click [here](CONTRIBUTING.md) to find out how to do it ;)

## License

This action is distributed under the MIT license, check the [license](LICENSE) for more info.
