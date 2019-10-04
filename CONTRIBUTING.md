# Contributing

### Issues
If you have a problem with this action and/or want a new feature to be added, please open a new issue from [here](https://github.com/EndBug/version-check/issues/new/choose).  
You will be prompted to choose a template: if none of the templates describes your kind of issue, you can always create a normal one.

If you're reporting a bug please be specific and include any helpful log/workflow snippet, as this will make the process easier for everyone :)  
If you're asking for a new feature to be added, please be specific about what you want it to do and which use cases are you thinking to.

### Pull requests
When opening a pull request, do not the push `node_modules` and `lib` folders (which are ignored by default): they get automatically updated by the actions on this repo.  

When making changes to the code edit only files located in the `src` folder, and use only TypeScript (`.ts`) files: there's no current style guide or linting set up, but it would be awesome if you could keep more or less the same style .  
You can check whether your code compiles or not by running the `npm run build` script: that will compile your code to JavaScript files (which you won't commit) in the `lib` folder.  

If you've never used TypeScript before:
- You should really start usign it, it's soooooo useful!
- Most of the times valid JavaScript is also valid TypeScript: you can write your stuff as you would in JS and fix the stuff that causes TS errors/warnings. You can set your IDE to show you these errors before compiling, so that you don't have to build the code every time.
