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
const sep = os.EOL + os.EOL;

function convert(text) {
    let result = '';
    let lines = text.split(/\r?\n/);

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
            result += sep;
        } else {
            result += ' ';
        }
    }

    return result;
}

// List all srt files in the input folder
// Read all their contents
let content = fs.readdirSync(folder)
    .map(file => path.join(folder, file))
    .filter(file => path.extname(file).toLowerCase() == ".srt" && fs.lstatSync(file).isFile())
    .map(file => path.basename(file, ".srt") + sep + convert(fs.readFileSync(file).toString()))
    .join(sep);

// Get folder name - use it as the output txt name
// Save output 
fs.writeFileSync(folder + '.txt', content);

console.log('Done.');