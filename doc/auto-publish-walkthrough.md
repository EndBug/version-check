*Note: the result of all these steps can be found [here][1], in the workflow file I actually used for my package.*

## 1. Making sure that the "publish" job gets executed on the version that has been just built

The easiest way I found was just to put the two jobs in the same workflow, and having them both fire on every `push` event: the publish job was then limited to execute only if on the `master` branch and after the first one.

 - **Build job:**  

It needs to build the new version of the package, then **commit** it to the repository: committing is crucial because that allows the other job to pick the built version. To commit the changes made inside a workflow run, you can use one of my actions, [`add-and-commit`][2]: it will push the changes to the GitHub repository using a "fake" git user.  
You workflow job should look something like this:

```yml
jobs:
  build:
    name: Build
    runs-on: ubuntu-latest

    steps: 
    - name: Checkout repository
      uses: actions/checkout@v2

    - name: Set up Node.js
      uses: actions/setup-node@v1
      with:
        node-version: '10.x'
    
    - name: Install dependencies
      run: npm install --only=prod

    - name: Compile build
      run: npm run build # This can be whatever command you use to build your package

    - name: Commit changes
      uses: EndBug/add-and-commit@v2
      with: # More info about the arguments on the action page
        author_name: Displayed name
        author_email: Displayed email
        message: "Message for the commit"
        path: local/path/to/built/version
        pattern: "*.js" # Pattern that matches the files to commit
        force: true # Whether to use the --force flag
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # This gets generated automatically
```


 - **Publish job:**  

We want it to run only in the `master` branch after `build` is completed, so we can set it like this:

```yml
publish:
  name: Publish to NPM & GitHub Package Registry
  runs-on: ubuntu-latest
  if: contains(github.ref, 'master') # This sets the branch
  needs: build # This makes it wait for the build job
```

## 2. Detecting a version change  
I didn't find a good way to do that so I made another action, [`version-check`][3]: this action scans the commits of every push and tries to figure out whether they include a version change. Remeber to set eventual needed arguments/inputs!  
You need to set up these two steps:

```yml
steps:
- name: Checkout repository
  uses: actions/checkout@v2
  with:
    ref: master

- name: Check version changes
  uses: EndBug/version-check@v1 # More info about the arguments on the action page
  id: check # This will be the reference for later
```

## 3. Using the results of the check to edit the behavior of the workflow

[`version-check`][3] provides three outputs: `changed` (whether there has been an update), `type` (the type of update, like "patch", "minor", ...) and `version` (the new version).  
These outputs can be accessed through the [`steps` context][4] and you can use them to decide whether to run a step or not, using the [`if` property][5]. This is an example:

```yml
# check is the id we gave to the check step in the previous paragraph
- name: Version update detected
  if: steps.check.outputs.changed == 'true'
  run: 'echo "Version change found! New version: ${{ steps.check.outputs.version }} (${{ steps.check.outputs.type }})"'
```

## 4. Publishing a package to NPM

Publishing a package to NPM is pretty straight-forward: you only need to set up Node.js and then use `npm publish`, like you would on your own machine. The only difference is that you'll need a token to authenticate: you can create one on [npmjs.com][6]. After you created it DO NOT put it in the workflow itself: you can store it as a "secret", you can find more info about those [here][7].  
In this example, I'll assume your secret is called `NPM_TOKEN`:

```yml
- name: Set up Node.js for NPM
  if: steps.check.outputs.changed == 'true'
  uses: actions/setup-node@v1
  with:
    registry-url: 'https://registry.npmjs.org' # This is just the default registry URL

- name: Install dependencies
  if: steps.check.outputs.changed == 'true'
  run: npm install

- name: Publish the package to NPM
  if: steps.check.outputs.changed == 'true'
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} # NPM will automatically authenticate with this
```

## 5. Publishing a package to GitHub Package Registry

As for now, GitHub Package Registry is not very pleasant to work with if you want to keep publishing your existing package to npm: that's why it requires packages to be scoped, and that can mess thing up (your package may not be scoped or be scoped under a different name).  
I found that the easiest way to deal with that is doing this workaround:

 - In your workflow, re-setup Node.js but adding GPR's registry URL and your name-scope
 - Create an npm script that edits your package.json so that it changes the original name of the package to the one you need to publish to GPR (scope included)
 - After calling that script in your workflow, use `npm publish` as before, but this time using the built-in `GITHUB_TOKEN` as `NODE_AUTH_TOKEN`.

```json
{
  "name": "YourPackageName",
  ...
  "scripts": {
    "gpr-setup": "node scripts/gpr.js"
  }
}
```

```js
// scripts/gpr.js

const fs = require('fs')
const { join } = require('path')

// Get the package obejct and change the name
const pkg = require('../package.json')
pkg.name = '@yourscope/YourPackageName'

// Update package.json with the udpated name
fs.writeFileSync(join(__dirname, '../package.json'), JSON.stringify(pkg))
```

```yml
- name: Set up Node.js for GPR
  if: steps.check.outputs.changed == 'true'
  uses: actions/setup-node@v1
  with:
    registry-url: 'https://npm.pkg.github.com/'
    scope: '@yourscope'

- name: Set up the package for GPR
  if: steps.check.outputs.changed == 'true'
  run: npm run gpr-setup

- name: Publish the package to GPR
  if: steps.check.outputs.changed == 'true'
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Result

Your package is now published both to NPM and GPR (a description needs to be manually added to GPR though).
You can find all of the stuff I'm referring to in the 4.0.3 version of uptime-monitor:

 - [Build/publish workflow][1]
 - [GPR script][8]


  [1]: https://github.com/EndBug/uptime-monitor/blob/v4.0.3/.github/workflows/build-and-publish.yml
  [2]: https://github.com/marketplace/actions/add-commit
  [3]: https://github.com/marketplace/actions/version-check
  [4]: https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions#steps-context
  [5]: https://help.github.com/en/articles/workflow-syntax-for-github-actions#jobsjob_idif
  [6]: https://npmjs.com
  [7]: https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables
  [8]: https://github.com/EndBug/uptime-monitor/blob/v4.0.3/scripts/gpr.js
