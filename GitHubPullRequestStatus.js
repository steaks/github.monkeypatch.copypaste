/* global $, _ */
(function () {
    angular.module('core', [])
        .factory("StatusOptions", function () {
            return {
                accept: 1,
                reject: 2,
                inProgress: 3
            }
        })
        .factory("statusesManager", function (StatusOptions, $q, $http) {
            function StatusesManager(config) {
                this._statuses = {};
            }

            StatusesManager.prototype.getFromServer = function (repoId) {
                var self = this;
                return $http.get("http://192.168.0.112/v0.1/pullrequeststatus/statuses/", { repoId: repoId })
                    .success(function (serverStatuses) {
                        self._statuses = serverStatuses;
                        return self._statuses;
                    });
            };

            StatusesManager.prototype.getFromLoaded = function (pullRequestId) {
                return this._statuses[pullRequestId];
            };

            StatusesManager.prototype.postStatuses = function(repoId, pullRequestId, pullRequestStatuses) {
                this._statuses[pullRequestId] = pullRequestStatuses;
                $.post(
                    /*url*/"http://192.168.0.112/v0.1/pullrequeststatus/updatestatuses/",
                    /*data*/{ repoId: repoId, pullRequestId: pullRequestId, statuses: JSON.stringify(pullRequestStatuses) });
            };

            function LocalStorageStatusesManager(config) {
                StatusesManager.call(this, config);
            }

            LocalStorageStatusesManager.prototype = Object.create(StatusesManager.prototype);

            LocalStorageStatusesManager.prototype.getFromServer = function (repoId) {
                var statuses = JSON.parse(localStorage.pullRequestStatuses || "{}");
                this._statuses = statuses[repoId] || {};
                return $q.when(undefined);
            };

            LocalStorageStatusesManager.prototype.postStatuses = function (repoId, pullRequestId, pullRequestStatuses) {
                this._statuses[pullRequestId] = pullRequestStatuses;
                var statuses = JSON.parse(localStorage.pullRequestStatuses || "{}");
                statuses[repoId] = this._statuses;
                localStorage.pullRequestStatuses = JSON.stringify(statuses);
            };

            return new LocalStorageStatusesManager();
        })
        .factory("ListManager", function (StatusOptions, statusesManager) {

            function ListManager(config) {
                this._userId = config.userId;
                this._repoId = config.repoId;
                this.startPolling();
            }

            ListManager.prototype.startPolling = function () {
                var self = this;
                this.decoratePullRequests();
                setInterval(function () { self.decoratePullRequests() }, 1000);
            };

            ListManager.prototype.decoratePullRequests = function () {
                var self = this;
                if (!this._isListOpen()) { return; }
                statusesManager.getFromServer(this._repoId)
                    .then(function () {
                        $(".issues-listing .table-list [data-issue-id]")
                            .each(function (i, element) {
                                var $element = $(element);
                                var pullRequestId = parseInt($element.attr("data-issue-id"), 10);
                                var pullRequestInfo = statusesManager.getFromLoaded(pullRequestId);
                                if (!pullRequestInfo) { return; }
                                self._renderListItemBackground($element, pullRequestInfo[self._userId]);
                                self._renderListItemMetaInfo($element, pullRequestInfo);
                            });
                    });
            };

            ListManager.prototype._renderListItemBackground = function (element, status) {
                if (status === StatusOptions.accept) {
                    element.css("background-color", "rgba(0, 157, 89, 0.2)");
                }
                else if (status === StatusOptions.reject) {
                    element.css("background-color", "rgba(206, 60, 40, 0.2)");
                }
                else if (status === StatusOptions.inProgress) {
                    element.css("background-color", "rgba(255, 239, 198, 0.4)");
                }
                else {
                    element.css("background-color", "");
                }
            };

            ListManager.prototype._renderListItemMetaInfo = function ($element, pullRequestInfo) {
                var accepts = _.filter(pullRequestInfo, function (val) { return val === StatusOptions.accept; }).length.toString();
                var rejects = _.filter(pullRequestInfo, function (val) { return val === StatusOptions.reject; }).length.toString();
                if ($element.find(".issue-meta .votes-container").length === 0) {
                    $element.find(".issue-meta").append("<span class='votes-container'></span>");
                }
                $element.find(".issue-meta .votes-container").html("");
                $element
                    .find(".issue-meta .votes-container")
                    .append(accepts + ' <img class="emoji" title=":+1:" alt=":+1:" src="https://assets-cdn.github.com/images/icons/emoji/unicode/1f44d.png" height="15" width="15" align="absmiddle">')
                    .append(rejects + ' <img class="emoji" title=":-1:" alt=":-1:" src="https://assets-cdn.github.com/images/icons/emoji/unicode/1f44e.png" height="15" width="15" align="absmiddle">');
            };

            ListManager.prototype._isListOpen = function () {
                return $(".issues-listing .table-list [data-issue-id]").length !== 0;
            };

            return ListManager;
        })
        .factory("PullRequestManager", function (statusesManager, StatusOptions) {
            function PullRequestManager(config) {
                this._repoId = config.repoId;
                this._userId = config.userId;
                this._startPolling();
            }

            PullRequestManager.prototype._startPolling = function() {
                var self = this;
                this._getApprovalsAndRejections();
                setInterval(function () { self._getApprovalsAndRejections() }, 1000);
            };

            PullRequestManager.prototype._getPullRequestId = function () {
                return parseInt($(".gh-header-number").text().substring(1), 10);
            };

            PullRequestManager.prototype._arePullRequestStatusesTheSame = function (statusesA, statusesB) {
                if (!statusesA && !statusesB) { return true; }
                if (!statusesA || !statusesB) { return false; }
                if (_.size(statusesA) !== _.size(statusesB)) { return false; }
                return _.all(statusesA, function (status, userId) { return statusesB[userId] === status; });
            };

            PullRequestManager.prototype._getApprovalsAndRejections = function () {
                var self = this;
                var pullRequestId = this._getPullRequestId();
                if (!pullRequestId) { return; }

                var comments = $(".js-discussion .timeline-comment-wrapper")
                    .map(function (i, wrapper) {
                        var $wrapper = $(wrapper);
                        var userId = parseInt($wrapper.find("[data-user]").attr("data-user"));
                        var body = $wrapper.find(".comment-body").html();
                        body = body ? body.trim() : "";

                        var nonApproveEmojiStrings = body
                            .split('<img class="emoji" title=":+1:" alt=":+1:" src="https://assets-cdn.github.com/images/icons/emoji/unicode/1f44d.png" height="20" width="20" align="absmiddle">')
                            .map(function (str) { return str.trim();  });
                        var isApproval = nonApproveEmojiStrings.length === 2 && nonApproveEmojiStrings[0] === "<p>" && nonApproveEmojiStrings[1] === "</p>"

                        var nonRejectEmojiStrings = body
                            .split('<img class="emoji" title=":-1:" alt=":-1:" src="https://assets-cdn.github.com/images/icons/emoji/unicode/1f44e.png" height="20" width="20" align="absmiddle">')
                            .map(function (str) { return str.trim(); });
                        var isRejection = nonRejectEmojiStrings.length === 2 && nonRejectEmojiStrings[0] === "<p>" && nonRejectEmojiStrings[1] === "</p>"


                        return {
                            userId: userId,
                            status: isApproval ? StatusOptions.accept : (isRejection ? StatusOptions.reject : null)
                        };
                    });
                var updatedPullRequestStatuses =
                    _(comments)
                        .filter(function (comment) { return comment.status; })
                        .groupBy(function (comment) { return comment.userId; })
                        .map(function (userComments) {
                            return _.last(userComments);
                        })
                        .reduce(function (seed, val) { seed[val.userId] = val.status; return seed; }, {});
                if (!updatedPullRequestStatuses[this._userId]) {
                    updatedPullRequestStatuses[this._userId] = StatusOptions.inProgress;
                }

                if (!this._arePullRequestStatusesTheSame(statusesManager.getFromLoaded(pullRequestId), updatedPullRequestStatuses)) {
                    statusesManager.postStatuses(this._repoId, pullRequestId, updatedPullRequestStatuses);
                }
            };
            return PullRequestManager;
        })
        .factory("main", function (ListManager, PullRequestManager) {
            var run = function () {
                var userId = parseInt($(".header-nav-link [data-user]").attr("data-user"), 10);
                var repoId = parseInt($("#repository_id").val(), 10);

                if (repoId && userId) {
                    var listManager = new ListManager({ userId: userId, repoId: repoId });
                    var pullRequestManager = new PullRequestManager({ userId: userId, repoId: repoId });
                }
            };
            return { run: run };
        });

    angular.injector(['ng', 'core']).invoke(function (main) {
        main.run();
    })
})();

