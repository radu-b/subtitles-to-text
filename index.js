'use strict';

function convert(files, options) {

    let filesLoaded = Array.from(files).map(file => {
        let child = { name: file.name };
        let lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.srt')) {

            return new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onload = e => {
                    child.text = e.target.result;
                    resolve(child);
                };

                reader.readAsText(file);
            });

        } else if (lowerName.endsWith('.zip')) {

            // Only supports one level deep ZIP files
            return new JSZip()
                .loadAsync(file)
                .then(zip => {
                    return Promise
                        .all(Object.keys(zip.files)
                            .filter(entry => entry.toLowerCase().endsWith('.srt'))
                            .map(entry => {
                                let grandchild = { name: entry };
                                return zip.files[entry]
                                    .async('string')
                                    .then(text => {
                                        grandchild.text = text;
                                        return grandchild;
                                    });
                            })
                        )
                        .then(grandchildren => {
                            child.children = grandchildren;
                            return child;
                        });
                });
        }
    });

    return Promise
        .all(filesLoaded)
        .then(children => {
            let tree = { children };
            sortTree(tree);

            let outputParts = [];
            convertTree(tree, 0, outputParts, options);
            let output = outputParts.join('\n');

            if (options.html) {
                let style = `p { text-indent: 0em; margin-top: 0.6em; }; h3 { margin-top: 0.6em;}`;
                output = `
                <html>
                    <head>
                        <style>
                        ${style}
                        </style>
                    </head>
                <body>
                ${output}
                </body>
                </html>`.replace(/^                /g, '');
            }

            return output;
        });
}

function sortTree(tree) {
    if (tree.children) {
        tree.children.sort((a, b) => a.name.compareTo(b.name));

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
        .replace(/subtitles?$/i, '');

    if (options.html) {
        let h = 'h' + (depth + 1);
        heading = '<' + h + '>' + escapeHtml(cleanText) + '</' + h + '>';

        if (options.kindle && depth == 0) {
            heading = '<mbp:pagebreak />' + heading;
        }
    } else {
        if (depth < 3) {
            heading = cleanText + '\n' + (depth == 1 ? '=' : '-').repeat(cleanText.length);
        } else {
            heading = '#'.repeat(depth + 1) + ' ' + cleanText;
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

document.getElementById('buttonConvert').addEventListener('click', () => {
    let input = document.getElementById('inputFile');
    if (input.files.length == 0) {
        return;
    }

    let radios = document.getElementsByName('format');
    let format = Array.from(radios).filter(r => r.checked)[0].value;
    let options = { html: format > 0, kindle: format == 2 };

    convert(input.files, options)
        .then(output => {
            let linkDownload = document.getElementById('linkDownload');
            linkDownload.href = 'data:application/x-download;charset=utf-8,' + encodeURIComponent(output);
            linkDownload.download = options.html ? 'converted.html' : 'converted.txt';
        });
});