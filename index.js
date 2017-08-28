var StaticServer = require('static-server');
var server = new StaticServer({
  rootPath: 'build',            // required, the root of the server file tree 
  name: 'http-server',   // optional, will set "X-Powered-by" HTTP header 
  port: process.env.PORT || 5000,               // optional, defaults to a random port 
  templates: {
    notFound: '404.html'    // optional, defaults to undefined 
  }
});
 
server.start(function () {
  console.log('Server listening to', server.port);
});
 
server.on('request', function (req, res) {
  // req.path is the URL resource (file name) from server.rootPath 
  // req.elapsedTime returns a string of the request's elapsed time 
});
 
server.on('response', function (req, res, err, file, stat) {
  // res.status is the response status sent to the client 
  // res.headers are the headers sent 
  // err is any error message thrown 
  // file the file being served (may be null) 
  // stat the stat of the file being served (is null if file is null) 
 
  // NOTE: the response has already been sent at this point 
});