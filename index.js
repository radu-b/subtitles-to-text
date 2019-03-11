'use strict';

function convert(files, options) {
    let tree = {};

    let filesLoaded = Array.from(files).map(file => {
        let lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.srt')) {

            return new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onload = e => {
                    appendToTree(tree, [], file.name, e.target.result);
                    resolve();
                };

                reader.readAsText(file);
            });

        } else if (lowerName.endsWith('.zip')) {
            return new JSZip()
                .loadAsync(file)
                .then(zip => {
                    return Promise
                        .all(Object.keys(zip.files)
                            .filter(entry => entry.toLowerCase().endsWith('.srt'))
                            .map(entry => {
                                let entryPathItems = entry.split('/');
                                let entryName = entryPathItems[entryPathItems.length - 1];
                                let entryParentNames = entryPathItems.slice(0, entryPathItems.length - 1);

                                return zip.files[entry]
                                    .async('string')
                                    .then(text => {
                                        appendToTree(tree, [file.name].concat(entryParentNames), entryName, text);
                                    });
                            })
                        );
                });
        }
    });

    return Promise
        .all(filesLoaded)
        .then(() => {

            sortTree(tree);

            let outputParts = [];
            convertTree(tree, 0, outputParts, options);
            let output = outputParts.join('\n');

            if (options.html) {
                let kindleStyle = `p { text-indent: 0em; margin-top: 0.6em; }; h1, h2, h3, h4 { margin-top: 0.6em;}`;
                let style = `body {max-width: 50em; margin: 0 auto;}`;
                output = `
                <html>
                    <head>
                        <style>
                        ${options.kindle ? kindleStyle : style}
                        </style>
                    </head>
                <body>
                ${output}
                </body>
                </html>`;
            }

            return output;
        });
}

function appendToTree(tree, parents, name, text) {
    if (!tree.children) {
        tree.children = [];
    }

    if (parents.length == 0) {
        tree.children.push({ name, text });
    } else {
        let firstParent = parents[0];
        let nextParents = parents.slice(1);

        let matching = tree.children.filter(child => child.name == firstParent);
        let parent;
        if (matching.length) {
            parent = matching[0];
        } else {
            parent = { name: firstParent };
            tree.children.push(parent);
        }

        appendToTree(parent, nextParents, name, text);
    }
}

function sortTree(tree) {
    if (tree.children) {
        tree.children.sort((a, b) => a.name.localeCompare(b.name));

        for (let child in tree.children) {
            sortTree(child);
        }
    }
}

function convertTree(tree, depth, outputParts, options) {
    if (tree.name) {
        outputParts.push(getHeading(tree.name, depth, options));
    }

    if (tree.text) {
        let paragraphs = convertToParagraphs(tree.text);
        let converted;
        if (options.html) {
            converted = paragraphs
                .map(p => '<p>' + escapeHtml(p) + '</p>')
                .join('\n');
        } else {
            converted = paragraphs.join('\n\n')
        }
        outputParts.push(converted);
    }

    if (tree.children && tree.children.length) {
        for (let child of tree.children) {
            convertTree(child, depth + 1, outputParts, options)
        }
    }
}

function getHeading(text, depth, options) {
    let heading;

    let cleanText = text
        .replace(/\.(srt|zip)$/i, '')
        .replace(/subtitles?$/i, '')
        .replace(/(\s-\s)?lang_en_vs1/i, '');

    if (options.html) {
        let h = 'h' + depth;
        heading = '<' + h + '>' + escapeHtml(cleanText) + '</' + h + '>';

        if (options.kindle && depth == 0) {
            heading = '<mbp:pagebreak />' + heading;
        }
    } else {
        if (depth < 3) {
            heading = cleanText + '\n' + (depth == 1 ? '=' : '-').repeat(cleanText.length);
        } else {
            heading = '#'.repeat(depth) + ' ' + cleanText;
        }

        heading += '\n';
    }

    return heading;
}

function convertToParagraphs(text) {

    let lines = text.split(/\r?\n/);
    let paragraphs = [];
    let paragraph = '';

    // Remove timestamps
    // Join lines into paragraphs, except where line ends with an end of sentence mark (.!?)
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (line.length == 0 ||
            line.indexOf(' --> ') > 0 ||
            (i < lines.length - 1 && lines[i + 1].indexOf(' --> ') > 0)) {
            continue;
        }

        paragraph += line;
        if (line.match(/[.!?]$/)) {
            paragraphs.push(paragraph);
            paragraph = '';
        } else {
            paragraph += ' ';
        }
    }

    paragraphs.push(paragraph);
    return paragraphs;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}


function main() {
    let currentBlob = null;
    let buttonConvert = document.getElementById('buttonConvert');

    function resetConvert() {
        buttonConvert.innerText = 'Convert';
        buttonConvert.classList.remove('done');
        currentBlob = null;
    }

    document.getElementById('inputFile').addEventListener('change', () => resetConvert());
    Array.from(document.getElementsByName('format'))
        .forEach(r => r.addEventListener('change', () => resetConvert()));

    buttonConvert.addEventListener('click', (e) => {
        if (currentBlob) {
            // We have data, just download it as normal, unless Edge
            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(currentBlob, buttonConvert.download);
                e.preventDefault();
            }

            return;
        }

        e.preventDefault();

        let input = document.getElementById('inputFile');
        if (input.files.length == 0) {
            return;
        }

        let format = Array.from(document.getElementsByName('format'))
            .filter(r => r.checked)[0].value;

        let options = { html: format > 0, kindle: format == 2 };

        convert(input.files, options)
            .then(output => {
                currentBlob = new Blob([output], { type: options.html ? 'text/html' : 'text/text' });
                buttonConvert.href = URL.createObjectURL(currentBlob);
                buttonConvert.download = options.html ? 'converted.html' : 'converted.txt';
                buttonConvert.innerText = 'Download';
                buttonConvert.classList.add('done');
            });
    });
}

main();
