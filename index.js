/*jshint node:true */
/*global require, Promise */

'use strict';

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

var Stats = function() {

    var client;
    var conversationFeedItems = [];
 
    this.logon = function() {
        logger.info('[APP]: Create client instance');

        return new Promise(function (resolve, reject) {
            var bot = config.bot;      

            logger.info('[APP]: createClient');
            // Use Client Credentials grant for the bots
            client = new Circuit.Client({
                client_id: bot.client_id,
                client_secret: bot.client_secret,
                domain: config.domain
            });
            //self.addEventListeners(client);  // register evt listeners

            client.logon()
                .then(user => {
                    logger.info('[APP]: Logon was successful');
                    resolve();
                })
                .catch(reject);
        })
        ;
    };

    this.getConversationFeedItems = function() {
        logger.info('[APP]: Fetching conversations');

        return new Promise(function (resolve, reject) {
            var conversationId = config.conversationId;

            if (!conversationId) {
                logger.error('[APP] conversationId not provided in config.json');
                reject();
            }

            client.getConversationItems(conversationId)
                .then(items => {
                    //logger.info('[APP]', items);
                    conversationFeedItems = items;
                    resolve(items);
                })
                .catch(err => {
                    logger.error('[APP] error fetching conversation items');
                });

        });
    };

    this.fetchConferenceCalls = function(items) {
        logger.info('[APP]: Total conference calls: ' + items.length);        
    };

    this.terminate = function() {
        logger.info('[APP] terminating app');
        process.exit(1);
    };

};


function run() {
    logger.info('Init function');

    var stats = new Stats();

    stats.logon()
        .then(stats.getConversationFeedItems)
        .then(stats.fetchConferenceCalls)
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