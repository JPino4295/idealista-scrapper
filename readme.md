# Environment Variables


| Variable          | Mandatory | Description                                                                                   |
|-------------------|-----------|-----------------------------------------------------------------------------------------------|
| BASE_URL          | YES       | The base url to search. Right now only accepts Idealista                                      |
| SEARCH_URL        | YES       | The search url to search. Right now only accepts from Idealista. Must not start with /        |
| USER_AGENT        | NO        | Desired User-Agent.                                                                           |
| TELEGRAM_TOKEN    | YES       | Token of the telegram bot                                                                     |
| TELEGRAM_GROUP_ID | YES       | Id from the group where the bot will be sending messages                                      |
| DB_URL            | YES       | MongoDb url                                                                                   |
| TESTING           | NO        | true if testing, false for production. When testing, nothing related with the db will be done |

MongoDB: Version used 4.4.6


To iniciate the process, just use node index.js