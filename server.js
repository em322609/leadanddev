
var http = require('http');
var express = require('express');
var authHelper = require('./authHelper.js');
var outlook = require('node-outlook');
var url = require('url');
//var mongoose = require('mongoose');
//mongoose.connect('mongodb://localhost/test');




var app = express();
var server = http.createServer(app);

app.use(express.static(__dirname));

server.listen(3000);
var io = require('socket.io').listen(server);
var usernames = {};
var tokens = {};


app.get('/', function (req, res) {
    console.log("Request handler 'home' was called.");
    res.send('<p>Please <a href="' + authHelper.getAuthUrl() + '">sign in</a> with your Ohio University Email.</p>');
    
});

app.get('/authorize', function (request,response) {
    console.log("Request handler 'authorize' was called.");
    
    // The authorization code is passed as a query parameter
    var url_parts = url.parse(request.url, true);
    var code = url_parts.query.code;
    console.log("Code: " + code);

    
    var token = authHelper.getTokenFromCode(code, tokenReceived, response);
    
     
    
});



app.get('/setapt', function (req, res) {
    console.log("Request handler setapt was called.");
    
    
    res.sendFile(__dirname + '/setapt.htm', req.get('Set-Cookie'));

    io.on('connection', function (socket) {
        
        socket.on('adduser', function (email, token) {
            
            socket.email = email;
            socket.token = token;
            tokens[email] = token;
            usernames[email] = socket.id;
            
            var queryParams = {
                '$select': 'Subject,Start,End',
                '$orderby': 'Start/DateTime desc',
                '$top': 20
            };
            
            // Set the API endpoint to use the v2.0 endpoint
            outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');
            // Set the anchor mailbox to the user's SMTP address
            outlook.base.setAnchorMailbox(email);
            // Set the preferred time zone.
            // The API will return event date/times in this time zone.
            outlook.base.setPreferredTimeZone('Eastern Standard Time');
            
            
            outlook.calendar.getEvents({ token: token, odataParams: queryParams },
    function (error, result) {
                if (error) {
                    console.log('getEvents returned an error: ' + error);
                    socket.emit('error', error);
                }
                else if (result) {
                    console.log('getEvents returned ' + result.value.length + ' events.');
                    
                    result.value.forEach(function (event) {
                        if (event.Subject == 'Open') {
                            var year = event.Start.DateTime.substr(0, 4);
                            
                            var month = event.Start.DateTime.substr(5, 2);
                            var intMonth = parseInt(month);
                            intMonth -= 1;
                            month = intMonth.toString();

                            var day = event.Start.DateTime.substr(8, 2);
                            var finalTime;

                            var startTime = event.Start.DateTime.substr(11, 5);
                            finalTime = "" + startTime + " AM";
                            var hour = startTime.substr(0, 2);
                            var mins = startTime.substr(3, 2);
                            var intHour = parseInt(hour);
                            if (intHour > 12) {
                                intHour -= 12;
                                finalTime = "" + intHour + ":" + mins + " PM";
                            }
                            
                            
                            var newDate = new Date(year, month, day);
                            var stringDate = newDate.toDateString();

                            console.log('  Subject: ' + event.Subject);
                            if(newDate >= new Date())
                            socket.emit('addEvent', stringDate,finalTime, email);
                        }
                    });
     
                }
    
            
            });
        });
    });
});




/*app.get('/dbtest', function (request, response) {
    mongoose.model('Ohio University Outlook Emails', studentEmailSchema).find(function (err, email) {
        response.send(email);
    });
});*/


/*var studentEmailSchema = mongoose.Schema({
    Email : String,
    access_token : String
});*/

function tokenReceived(response, error, token) {
    if (error) {
        console.log("Access token error: ", error.message);
        response.writeHead(200, { "Content-Type": "text/html" });
        response.write('<p>ERROR: ' + error + '</p>');
        response.end();
    }
    else {
        var cookies = ['leaddev-token=' + token.token.access_token + ';Max-Age=3600',
           'leaddev-email=' + authHelper.getEmailFromIdToken(token.token.id_token) + ';Max-Age=3600'];
        response.setHeader('Set-Cookie', cookies);
        
        
        //var loginCredentials = mongoose.model('Ohio University Outlook Emails', studentEmailSchema);
        //var user = new loginCredentials({ Email : '' + authHelper.getEmailFromIdToken(token.token.id_token), access_token : ''+token.token.access_token });
        

        /*user.save(function (err) {
            if (err) {
                console.log('there was an error saving outlook account to mongo db');
            }
        });*/
        
        
        response.redirect('/setapt');
        
    }
}

function getValueFromCookie(valueName, cookie) {
    if (cookie.indexOf(valueName) !== -1) {
        var start = cookie.indexOf(valueName) + valueName.length + 1;
        var end = cookie.indexOf(';', start);
        end = end === -1 ? cookie.length : end;
        return cookie.substring(start, end);
    }
}






