#! /usr/bin/env node
"use strict";

const ts = require('typescript');

const { readFileSync } = require("fs");

const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');

const parser = require('./lib/parser');
const printer = require('./lib/printer').default;
const tree = require('./lib/tree').default;

const optionDefinitions = [
  {
    name: 'help',
    description: 'Display this usage guide.',
    alias: 'h',
    type: Boolean
  },
  { 
    name: 'src', 
    type: String, 
    multiple: true, 
    defaultOption: true, 
    typeLabel: '[underline]{file} ...',
    description: 'Typescript definition files' 
  },
  { 
    name: 'out', 
    alias: 'o', 
    type: String,
    description: 'The name of the flow output file' 
  },
]

const usageDefinitions = [
  {
    header: 'Typedef Converter',
    content: 'Generates flow libraries from typescript files'
  },
  {
    header: 'Options',
    optionList: optionDefinitions
  },
  {
    content: 'Project home: [underline]{https://github.com/joarwilk/typedef-converter}'
  }
]

const options = commandLineArgs(optionDefinitions);
const usage = getUsage(usageDefinitions);

if (options.help) {
  console.log(usage);
}

if (options.src) {
  options.src.forEach(fileName => {
    const sourceFile = ts.createSourceFile(fileName, 
      readFileSync(fileName).toString(), 
      ts.ScriptTarget.ES6, 
      /*setParentNodes */ false
    );

    parser.recursiveWalkTree(sourceFile);
  });
}

var fs = require('fs');
fs.writeFile("./out.flow.js", (printer(tree.exportFormatted())), function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
});