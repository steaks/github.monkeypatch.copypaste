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
        if (!window.location.href.match(/.*\/pull.*/) && !window.location.href.match(/.*\/commit.*/)) {
            return;
        }
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
        //I'm not exactly sure why a timeout is useful here.  The behavior indicates that with out a timeout sometimes
        //the copy clipboard does not actually have the correctly cleaned text.  The timeout seems to mitigate that problem.
        //My best guess is that there is a race condition and the timeout makes this code "lose" the race condition...so
        //the last text in the clipboard is this cleaned text rather than the regular text.
        setTimeout(function () { chrome.runtime.sendMessage({ cleanedSelectionText: cleanedSelectionText }); });
    });
})();
