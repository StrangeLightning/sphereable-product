var AWS = require('aws-sdk');
var config;

try {
  config = require("./environment");
} catch(e) {
  console.log(e);
}

AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID || config.amazon.cloudsearchAmazonId,
  secretAccessKey:  process.env.SECRET_ACCESS_KEY || config.amazon.cloudsearchAmazonSecret,
  region: 'us-west-2'
});

//AWS cloudsearchdomain configuration
exports.cloudsearchdomain = new AWS.CloudSearchDomain({
  endpoint: 'https://search-imorgo-axx2j6p35ftfdsmbwrupypvdy4.us-west-2.cloudsearch.amazonaws.com',
  apiVersion: '2013-01-01'
});

//AWS cloudsearch configuration
exports.cloudsearch = new AWS.CloudSearch({
  apiVersion: '2013-01-01'
});

exports.domain = "sphereable";