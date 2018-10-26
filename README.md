This node.js bot application parses the contents of a Circuit conversation and filters out the conference calls. Then it parses the filtered conferences and creates two reports: one with the attenders for each conference call and one for the non-attenders (attenders.txs and non-attenders.txt). Both files are generated inside the folder of the application and they have the following sample format.

conferenceId,date,participantName
0,2018/Sep/28 12:45,Aristotelis Kanellos
0,2018/Sep/28 12:45,Ricky El-Qasem

A prerequisite for this application is to have a Circuit OAuth application created in the tenant where the conversation with conference calls is hosted. You need to fetch the client_id and client_secret from the Circuit tenant administrator and add them in the config.json.

After that you need to provide the domain name of the Circuit deployment (eg. eu.yourcircuit.com, beta.circuit.com) and the id of conversation to parse. You can easily fetch the conversation from the browser address bar after clicking the relevant conversation. For example for https://eu.yourcircuit.com/#/conversation/6c9a22a2-b5f3-49ea-9974-d9c12a34ea74 its id is the UUID part of the URL (6c9a22a2-b5f3-49ea-9974-d9c12a34ea74).

Optionally you can can specify a start and end date so that the application can filter and report only for the conference calls between these dates. If you decide to provide filtering dates they need to be entered in the following format YYYY/MM/DD.

To execute the application you need to have the node.js application installed in you environment. Then from a command line navigate inside the folder where the application is donwnloaded and execute the commands below.

npm install  // installs the application depencies

node index.js  // executes the application

Depending on the size of the conversation the execution may take from a few to several seconds. After executing the 'node index.js' the expected output should be like the one below.

{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Get Circuit instance","time":"2018-10-26T09:54:45.674Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"Using proxy ${process.env.http_proxy}","time":"2018-10-26T09:54:45.884Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Create client instance","time":"2018-10-26T09:54:45.886Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: createClient","time":"2018-10-26T09:54:45.887Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Logon on as athensautomation@gmail.com","time":"2018-10-26T09:54:49.894Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Fetching all conversation participants","time":"2018-10-26T09:54:49.894Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Conversation has 3 participants.","time":"2018-10-26T09:54:50.125Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Fetching conference items","time":"2018-10-26T09:54:50.125Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Conversation items will be filtered using start date 2018/03/20 and end date 2018/10/11","time":"2018-10-26T09:54:50.428Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Writing report for conference attenders","time":"2018-10-26T09:54:50.429Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Successfully created new file attenders.txt","time":"2018-10-26T09:54:50.431Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Writing report for conference non-attenders","time":"2018-10-26T09:54:50.431Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Successfully created new file non_attenders.txt","time":"2018-10-26T09:54:50.432Z","v":0}
{"name":"app","hostname":"ubuntu","pid":14844,"level":30,"msg":"[APP]: Terminating app","time":"2018-10-26T09:54:50.432Z","v":0}
