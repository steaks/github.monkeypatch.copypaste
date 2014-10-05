(function () {
    function resolveLineEnding(selectionText, lines) {
        if (selectionText.split(/\r\n/).length === lines.length) {
            return "\r\n";
        }
        else if (selectionText.split(/\n/).length === lines.length) {
            return "\n";
        }
        else {
            return "\r";
        }
    }
    
    $(document).on("copy", function () {
        var selection = window.getSelection(),
            selectionText = selection.toString(), 
            lines = selectionText.split(/\r\n|\r|\n/),
            metaInfoRegex = /@@ -[0-9]+,[0-9]+ \+[0-9]+,[0-9]+ *@@[ ]?/,
            lineEnding = resolveLineEnding(selectionText, lines),
            cleanedSelectionText;
        
        cleanedSelectionText = lines.reduce(function (agg, curr, index) {
            var cleanedCurr = curr[0] === "+" || curr[0] === "-" || curr.charCodeAt(0) === 32 || curr.charCodeAt(0) === 160
                ? curr.replace(metaInfoRegex, "").substr(1) 
                : curr.replace(metaInfoRegex, "");
            return agg + cleanedCurr + (index !== lines.length - 1 ? lineEnding : "");
        }, "");
        chrome.runtime.sendMessage({ cleanedSelectionText: cleanedSelectionText });
    });
})();
