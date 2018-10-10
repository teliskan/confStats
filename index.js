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

// Circuit SDK
logger.info('[APP]: get Circuit instance');
var Circuit = require('circuit-sdk');

// Create proxy agent to be used by SDKs WebSocket and HTTP requests
if (process.env.http_proxy) {
    var HttpsProxyAgent = require('https-proxy-agent');
    Circuit.NodeSDK.proxyAgent = new HttpsProxyAgent(url.parse(process.env.http_proxy));
    logger.info('Using proxy ${process.env.http_proxy}');
}

var EXPORT_FILE_NAME = 'export.txt';

var Stats = function() {

    var client;
    var conversationId;
    var conferenceParticipants = [];

    function timestampToDate (timestamp) {
        var date = new Date(timestamp);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var year = date.getFullYear();
        var month = months[date.getMonth()];
        var dom = date.getDate();
        var hour = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();
        var time = dom + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
        return time;
    }

    function fetchAllConferenceParticipants() {
        return client.getConversationParticipants(conversationId, {pageSize: 100})
            .then(res => {
                if (res.participants.length > 0 ) {
                    Array.prototype.push(conferenceParticipants, res.participants);
                }
                if (res.hasMore) {
                    fetchAllConferenceParticipants();
                } else {
                    return;
                }
            });
    }

    function fetchAllConversationItems() {
        var conversationItems = [];

        return client.getConversationItems(conversationId)
            .then(items => {
                if (items.length > 0 ) {
                    Array.prototype.push(conversationItems, res.participants);
                }
                if (res.hasMore) {
                    fetchAllConferenceParticipants();
                } else {
                    return;
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
            .then(user => {
                logger.info('[APP]: Logon on as ${user.emailAddress:}');
            });
    };

    this.fetchConferenceParticipants = function() {
        logger.info('[APP]: Fetching all conversation participants');
        conversationId = config.conversationId;

        if (!conversationId) {
            logger.error('[APP]: conversationId not provided in config.json');
            throw 'conversationId not provided in config.json';
        }

        return fetchAllConferenceParticipants(conversationId);
    };

    this.getConversationFeedItems = function() {
        logger.info('[APP]: Fetching conversations');
        conversationId = config.conversationId;

        return client.getConversationItems(conversationId);
        //         .then(items => {
        //             resolve(items);
        //         })
        //         .catch(err => {
        //             logger.error('[APP]: error fetching conversation items');
        //         });

        // });
    };

    this.fetchConferenceCalls = function(items) {
        var conferenceCalls = [];
        logger.info('[APP]: Total feed items: ' + items.length);
        items.forEach(function (item, idx) {
            if (item.type === 'RTC' && item.rtc && item.rtc.type === 'ENDED') {
                conferenceCalls.push(item);
            }
        });
        logger.info('[APP]: Found conference calls: ' + conferenceCalls.length);
        return conferenceCalls;
    };

    this.filterBasedOnDate = function(items) {
        var conferenceCalls = [];
        logger.info('[APP]: Total feed items: ' + items.length);
        items.forEach(function (item, idx) {
            if (item.type === 'RTC' && item.rtc && item.rtc.type === 'ENDED') {
                conferenceCalls.push(item);
            }
        });
        logger.info('[APP]: Found conference calls: ' + conferenceCalls.length);
        return conferenceCalls;
    };

    this.exrtactInfoFromConfCalls = function(conferenceCalls) {
        logger.info('[APP]: Creating report: ' + conferenceCalls.length);
        
        if (conferenceCalls) {
            var stream = fs.createWriteStream(EXPORT_FILE_NAME);
            logger.info('[APP]: Writing report for conference attendes');
            return new Promise(function (resolve, reject) {
                stream.on('finish', function () {
                    logger.info('[APP]: Successfully created new file ' + EXPORT_FILE_NAME);
                    resolve();
                });
                stream.write('conferenceId,date,participantName\n');
            
                // Append entries for each Conference call
                conferenceCalls.forEach(function (conf, idx) {
                    if (conf.rtc.rtcParticipants) {
                        conf.rtc.rtcParticipants.forEach(function (participart) {
                            var fileEntry = idx + ',' + conf.creationTime + ',' + participart.displayName + '\n';
                            stream.write(fileEntry);
                        });
                    } else {
                        logger.warn('[APP]: No participants found for conference call with id ' + conf.itemId);
                    }
                });
                stream.end();
            });
        } else {
            return;
        }
    };

    this.terminate = function() {
        logger.info('[APP]: terminating app');
        process.exit(1);
    };

};

function run() {
    logger.info('Init function');

    var stats = new Stats();

    stats.logon()
        .then(stats.fetchConferenceParticipants)
        .then(stats.getConversationFeedItems)
        .then(stats.fetchConferenceCalls)
        .then(stats.filterBasedOnDate)
        .then(stats.exrtactInfoFromConfCalls)
        .then(stats.terminate)
        .catch(err => {
            var error = new Error(err);
            logger.error('[APP]: Error: ' + error.message);
            process.exit(1);
        });

}

//*********************************************************************
//* main
//*********************************************************************

run();
