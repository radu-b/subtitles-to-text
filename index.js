'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
if (args.length != 1) {
    console.log('Usage: npm start <folder containing SRT files>');
    return;
}

const folder = args[0];

// List all srt files in the input folder
// Read all their contents
let content = fs.readdirSync(folder)
    .map(file => path.join(folder, file))
    .filter(file => path.extname(file).toLowerCase() == ".srt" && fs.lstatSync(file).isFile())
    .map(file => fs.readFileSync(file).toString())
    .join('\n');

let lines = content.split(/\r?\n/);

let result = '';

// Remove timestamps
// Join lines into paragraphs, except where line ends with a dot
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.length == 0 ||
        line.indexOf(' --> ') > 0 ||
        (i < lines.length - 1 && lines[i + 1].indexOf(' --> ') > 0)) {
        continue;
    }

    result += line;
    if (line.match(/[.!?]$/)) {
        result += os.EOL + os.EOL;
    } else {
        result += ' ';
    }
}

// Get folder name - use it as the output txt name
// Save output 
fs.writeFileSync(folder + '.txt', result);

console.log('Done.');