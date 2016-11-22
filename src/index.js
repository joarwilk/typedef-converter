#! /usr/bin/env node
"use strict";

var fs = require('fs');

const ts = require('typescript');

const { readFileSync } = require("fs");

const program = require('commander');

const parser = require('./parser');
const { default: printer, printSimpleTree } = require('./printer');
const tree = require('./tree').default;

program
  .version('0.1.3')
  .arguments('[files...]')
  .option('-o --output-file [outputFile]', 'name for ouput file, defaults to export.flow.js', 'export.flow.js')
  .action((files, options) => {
    files.forEach(fileName => {
      const sourceFile = ts.createSourceFile(fileName, 
        readFileSync(fileName).toString(), 
        ts.ScriptTarget.ES6, 
        /*setParentNodes */ false
      );

      parser.recursiveWalkTree(sourceFile);
    });

    fs.writeFile('./' + options.outputFile, (printer(tree.exportFormatted())), function(err) {
        if (err) {
            return console.log(err);
        }

        console.log('Completed! Nodes exported:\n' + printSimpleTree(tree.exportRaw()));
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}