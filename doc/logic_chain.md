# Logic chain

This is how the action detects version changes, you can check out the code at [main.ts](../src/main.ts).

Generic commit processing:
1. Loop though all the commits and see which have a SemVer in their message
    - When you find one, check its diff: if it matches you're done, otherwise go to the next one
2. If no commit has been found and [`diff-search`](../README.md#inputs) is `true`, check every commit's diff

Specific commit processing:
1. Check if the commit edits the `package.json` file
2. Check that no more than two diff lines include the `"version"` property
3. Check that among those, there's at least one added lines
4. Check that the added version and the one where looking for are the same
