declare namespace semverDiff {
	type Result = 'major' | 'minor' | 'patch' | 'prerelease' | 'build';
}

/**
Get the diff type of two [semver](https://github.com/npm/node-semver) versions: `0.0.1 0.0.2` → `patch`.

@returns The difference type between two semver versions, or `undefined` if they're identical or the second one is lower than the first.

@example
```
import semverDiff = require('semver-diff');

semverDiff('1.1.1', '1.1.2');
//=> 'patch'

semverDiff('0.0.1', '1.0.0');
//=> 'major'

semverDiff('0.0.1', '0.1.0');
//=> 'minor'

semverDiff('0.0.1-foo', '0.0.1-foo.bar');
//=> 'prerelease'

semverDiff('0.1.0', '0.1.0+foo');
//=> 'build'

semverDiff('0.0.1', '0.0.1');
//=> undefined

semverDiff('0.0.2', '0.0.1');
//=> undefined
```
*/
declare function semverDiff(
	versionA: string,
	versionB: string
): semverDiff.Result | undefined;

export = semverDiff;
