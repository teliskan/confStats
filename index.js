/*jshint node:true */
/*global require, Promise */

'use strict';

// The File System module
var fs = require('fs');

// Logger
var bunyan = require('bunyan');

// Node utils
var url = require('url');

// Application logger
var logger = bunyan.createLogger({
    name: 'app',
    stream: process.stdout,
    level: 'info'
});

// Load configuration
var config = require('./config.json');

// Date regex dd/mm/yyyy
var DATE_REGEX = /^\d{4}(\/)(((0)[0-9])|((1)[0-2]))(\/)([0-2][0-9]|(3)[0-1])$/;


// Circuit SDK
logger.info('[APP]: Get Circuit instance');
var Circuit = require('circuit-sdk');

// Create proxy agent to be used by SDKs WebSocket and HTTP requests
if (process.env.http_proxy) {
    var HttpsProxyAgent = require('https-proxy-agent');
    Circuit.NodeSDK.proxyAgent = new HttpsProxyAgent(url.parse(process.env.http_proxy));
    logger.info('Using proxy ${process.env.http_proxy}');
}

var ATTENDERS_FILE_NAME = 'attenders.txt';
var NON_ATTENDERS_FILE_NAME = 'non_attenders.txt';

var Stats = function() {

    var client;
    var conversationId;
    var conversationParticipants = [];
    var conferenceCalls = [];
    var botUserId;
    var startDateTimestamp;

    function dateToTimestamp (date) {
        var dateArray = date.split('/');
        return new Date(dateArray[0] + "/" + dateArray[1] + "/" + dateArray[2] + " 00:00:00.000").getTime();
    }

    function timestampToDate (timestamp) {
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        var date = new Date(timestamp);
        var year = date.getFullYear();
        var month = months[date.getMonth()];
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = "0" + date.getMinutes();

        // Will display time in YYYY/MM/DD HH:MM format
        var formattedToDate = year + '/' + month + '/' + day + ' ' + hours + ':' + minutes.substr(-2);
        return formattedToDate;
    }

    function fetchAllConverationParticipants() {
        return client.getConversationParticipants(conversationId, {pageSize: 100})
                .then(function (res) {
                    if (res.participants.length > 0 ) {
                        conversationParticipants = conversationParticipants.concat(res.participants);
                    }
                    if (res.hasMore) {
                        return fetchAllConverationParticipants();
                    }
                });
    }

    function fetchAllConferenceItems(startTimestamp) {
        return client.getConversationFeed(conversationId, {timestamp: startTimestamp, minTotalItems: 25 ,maxTotalUnread: 500 ,commentsPerThread: 1 ,maxUnreadPerThread: 1})
                .then(function (res) {
                    if (res && res.threads && res.threads.length > 0) {
                        extractConferenceCalls(res.threads);
                        var olderThreadTimestamp = res.threads[0].parentItem.creationTime;
                        if (startDateTimestamp) {
                            if (olderThreadTimestamp > startDateTimestamp && res.hasOlderThreads) {
                                logger.info('[APP]: Fetching more conversation items. Have not reached startDate yet.');
                                return fetchAllConferenceItems(olderThreadTimestamp);
                            }
                        } else {
                            if (res.hasOlderThreads) {
                                logger.info('Fetching more conversation items. Have not rearched start of conversation yet.');
                                return fetchAllConferenceItems(olderThreadTimestamp);
                            }
                        }
                    }
                });
    }

    function extractConferenceCalls(items) {
        items.forEach(function (item) {
            if (item.parentItem.type === 'RTC' && item.parentItem.rtc) {
                conferenceCalls.push(item.parentItem);
            }
        });
    }

    this.logon = function() {
        logger.info('[APP]: Create client instance');

        var bot = config.bot;

        logger.info('[APP]: createClient');
        // Use Client Credentials grant for the bots
        client = new Circuit.Client({
            client_id: bot.client_id,
            client_secret: bot.client_secret,
            domain: config.domain
        });

        //self.addEventListeners(client);  // register evt listeners

        return client.logon()
            .then(function (user) {
                logger.info('[APP]: Logon on as ' + user.emailAddress);
                botUserId = user.userId;
            });
    };

    this.fetchConversationParticipants = function() {
        logger.info('[APP]: Fetching all conversation participants');
        conversationId = config.conversationId;

        if (!conversationId) {
            logger.error('[APP]: conversationId not provided in config.json');
            throw 'conversationId not provided in config.json';
        }

        return fetchAllConverationParticipants(conversationId);
    };

    this.getConferenceItems = function() {
        logger.info('[APP]: Fetching conference items');

        var startDate = config.startDate;
        var endDate = config.endDate;

        if (startDate && endDate) {
            if (!DATE_REGEX.test(startDate)) {
                throw 'startDate not in valid format in config.json. Should be in YYYY/MM/DD';
            }
            startDateTimestamp = dateToTimestamp(startDate);
        }

        return fetchAllConferenceItems();
    };

    this.filterBasedOnDates = function() {
        var filteredItems = [];
        var startDate = config.startDate;
        var endDate = config.endDate;

        if (startDate && endDate) {
            if (!DATE_REGEX.test(startDate)) {
                throw 'startDate not in valid format in config.json. Should be in YYYY/MM/DD';
            }
            if (!DATE_REGEX.test(endDate)) {
                throw 'endDate not in valid format in config.json. Should be in YYYY/MM/DD';
            }
            logger.info('[APP]: Conversation items will be filtered using start date ' + startDate + ' and end date ' + endDate);

            var startDateTimestamp = dateToTimestamp(startDate);
            var endDateTimestamp = dateToTimestamp(endDate);
            conferenceCalls.forEach(function (item) {
                if (startDateTimestamp <= item.creationTime && item.creationTime <= endDateTimestamp) {
                    filteredItems.push(item);
                }
            });
        } else {
            filteredItems = conferenceCalls;
        }
        return filteredItems;
    };

    this.exrtactInfoFromConfCalls = function(conferenceCalls) {
        logger.info('[APP]: Have found ' + conferenceCalls.length + ' conference calls. Now we will extract info about participants.');

        // Exclude the bot user from the conference participants list
        conversationParticipants.find(function (participart, idx) {
            if (participart.userId === botUserId) {
                conversationParticipants.splice(idx, 1);
                return true;
            }
            return false;
        });

        if (conferenceCalls) {
            var streamAtt = fs.createWriteStream(ATTENDERS_FILE_NAME);
            var streamNonAtt = fs.createWriteStream(NON_ATTENDERS_FILE_NAME);
            logger.info('[APP]: Writing report for conference attenders');

            return new Promise(function(resolve, reject) {
                streamAtt.on('finish', function () {
                    logger.info('[APP]: Successfully created new file ' + ATTENDERS_FILE_NAME);
                    resolve();
                });
                streamAtt.write('conferenceId,date,participantName\n');

                conferenceCalls.forEach(function (conf, idx) {
                    if (conf.rtc.rtcParticipants) {
                        conf.rtc.rtcParticipants.forEach(function (participart) {
                            var fileEntry = idx + ',' + timestampToDate(conf.creationTime) + ',' + participart.displayName + '\n';
                            streamAtt.write(fileEntry);
                        });
                    } else {
                        logger.warn('[APP]: No participants found for conference call with id ' + conf.itemId);
                    }
                });
                streamAtt.end();
            })
            .then(function () {
                logger.info('[APP]: Writing report for conference non-attenders');

                return new Promise(function(resolve, reject) {
                    streamNonAtt.on('finish', function () {
                        logger.info('[APP]: Successfully created new file ' + NON_ATTENDERS_FILE_NAME);
                        resolve();
                    });
                    streamNonAtt.write('conferenceId,date,participantName\n');

                    conferenceCalls.forEach(function (conf, idx) {
                        if (conf.rtc.rtcParticipants) {
                            conversationParticipants.forEach(function (convParticipant) {
                                var includesParticipant = conf.rtc.rtcParticipants.some(function (participart) {
                                    return participart.userId === convParticipant.userId;
                                });

                                if (!includesParticipant) {
                                    var fileEntry = idx + ',' + timestampToDate(conf.creationTime) + ',' + convParticipant.displayName + '\n';
                                    streamNonAtt.write(fileEntry);
                                }
                            });
                        } else {
                            logger.warn('[APP]: No participants found for conference call with id ' + conf.itemId);
                        }
                    });
                    streamNonAtt.end();
                });
            });
        } else {
            return;
        }
    };

    this.terminate = function() {
        logger.info('[APP]: Terminating app');
        process.exit(1);
    };

};

function run() {
    var stats = new Stats();

    stats.logon()
        .then(stats.fetchConversationParticipants)
        .then(stats.getConferenceItems)
        .then(stats.filterBasedOnDates)
        .then(stats.exrtactInfoFromConfCalls)
        .then(stats.terminate)
        .catch(function (err) {
            var error = new Error(err);
            logger.error('[APP]: Error: ' + error.message);
            process.exit(1);
        });
}

//*********************************************************************
//* main
//*********************************************************************

run();
