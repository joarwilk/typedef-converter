# Typescript to Flow converter

This projects exists because having to write duplicate library definitions is no fun at all.

## The state of the converter
It's surprisingly robust and non-lossy as it stands right now, in big part thanks to how similar flow and typescript definition files are.
I've ran it against the [typescript definition for yargs](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/yargs/yargs.d.ts) and it converted it to a flow library definition that worked out of the box.

It almost works with multiple files - biggest issue right now is not inserting the proper module, instead favouring the root module which should never have properties.

## The difficult parts

### Namespaces
Namespaces have been a big headache. What it does right now is that it converts any namespace to a module  
and then imports any references to that module. What's currently not working in terms of namespaces is exporting all
properties of the namespace as a default object, but that should be a fairly trivial change.

### Variables
Since TS and flow variables dont match in functionality, the converter has to resolve variable references manually.
A common case looks like this: 
```
var yargs: yargs.Argv;
	export = yargs;
```

Which then resolves to `declare module.exports: Argv`.

### External library imports
Definitions in TS and flow are often quite different, and imported types from other libraries dont usually have
a one-to-one mapping. As an example, libraries using `React.Component<>` are difficult to translate to flow. 
This might require manual processing, or we add a set of hardcoded mutations that handle common cases.

### Odd TS conventions
[Lodash](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/lodash/lodash.d.ts) has been one of the reference libraries i've worked with when creating the 
converter. The definition is mostly just a series of interfaces with the same name being re-declared over and over again for each function, which doesn't translate to flow at all.
If anyone knows how to make sense of the lodash definition, [send me a tweet](//twitter.com/joarwilk).

## Usage

Standard usage (will produce `lodash.flow.js`):
```
yarn global add typedef-converter
typedef-converter lodash.d.ts
```

### Options
```
-o / --out: Specifies the filename of the exported file
```