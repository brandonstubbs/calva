const vscode = require('vscode');
const state = require('../state');

const repl = require('../repl/client');
const message = require('../repl/message');
const {getNamespace, getActualWord} = require('../utilities');

module.exports = class HoverProvider {
    constructor() {
        this.state = state;
    }
    formatDocString(nsname, arglist, doc) {
        let result = '';
        if (nsname.length > 0 && nsname !== 'undefined') {
            result += '**' + nsname + '**  ';
            result += '\n';
        }

        // Format the different signatures for the fn
        if (arglist !== 'undefined') {
            result += arglist.substring(0, arglist.length)
                             .replace(/\]/g, ']_')
                             .replace(/\[/g, '* _[');
            result += '\n\n';
        }

        // Format the actual docstring
        if (doc !== 'undefined') {
            result += doc.replace(/\s\s+/g, ' ');
            result += '  ';
        }
        return result.length > 0 ? result : "";
    }

    provideHover(document, position, token) {
        let selected = document.getWordRangeAtPosition(position),
            selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
            text = getActualWord(document, position, selected, selectedText),
            docstring = "",
            arglist = "",
            nsname = "",
            scope = this,
            filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
            filetype = document.fileName.substr(filetypeIndex, document.fileName.length);
        if (this.state.deref().get('connected')) {
            return new Promise((resolve, reject) => {
                let current = scope.state.deref(),
                    client = repl.create().once('connect', () => {
                    let msg = message.info(current.get(filetype),
                                           getNamespace(document.getText()), text);
                    client.send(msg, function (results) {
                        for (var r = 0; r < results.length; r++) {
                            let result = results[r];
                                docstring += result.doc;
                                arglist += result['arglists-str'];
                                if(result.hasOwnProperty('ns') && result.hasOwnProperty('name')) {
                                  nsname = result.ns + "/" + result.name;
                                }
                        }
                        client.end();
                        if (docstring.length === 0) {
                            reject("Docstring not found for " + text);
                        } else {
                            let result = scope.formatDocString(nsname, arglist, docstring);
                            if (result.length === 0) {
                                reject("Docstring not found for " + text);
                            } else {
                                resolve(new vscode.Hover(result));
                            }
                        }
                    });
                });
            });
        } else {
            return new vscode.Hover("Not connected to nREPL..");
        }
    }
}
