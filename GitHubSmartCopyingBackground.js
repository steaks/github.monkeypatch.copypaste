(function () {
    function copyToClipboard( text ){
        var copyFrom = $('<textarea/>');
        copyFrom.text(text);
        $('body').append(copyFrom);
        copyFrom.select();
        document.execCommand('copy', true);
        copyFrom.remove();
    }

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            copyToClipboard(request.cleanedSelectionText);
        });
})();
