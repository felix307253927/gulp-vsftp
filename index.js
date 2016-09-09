/**
 * @license Created by felix on 15-5-23.
 * @email   307253927@qq.com
 */
'use strict';
var path    = require('path');
var fs      = require('fs');
var gutil   = require('gulp-util');
var util    = require('util');
var through = require('through2');
var SSH2    = require('ssh2');
var async   = require('async');
var parents = require('parents');

var normalizePath = function (path) {
  return path.replace(/\\/g, '/');
};

module.exports = function (options) {
  if (!options.host) {
    throw new gutil.PluginError('gulp-vsftp', '`host` required.');
  }
  options.user       = options.user || 'root';
  var fileCount      = 0;
  var remotePath     = options.remotePath || '/';
  var homePath       = options.cleanFiles ? remotePath : '';
  var remotePlatform = options.remotePlatform || 'unix';
  
  var authFilePath = options.authFile || '.ftppass';
  var authFile     = path.join('./', authFilePath);
  if (options.auth && fs.existsSync(authFile)) {
    var auth = JSON.parse(fs.readFileSync(authFile, 'utf8'))[options.auth];
    if (!auth)
      throw new gutil.PluginError('gulp-vsftp', 'Could not find authkey in .ftppass');
    if (typeof auth == "string" && auth.indexOf(":") != -1) {
      var authparts = auth.split(":");
      auth          = {user: authparts[0], pass: authparts[1]};
    }
    for (var attr in auth) {
      options[attr] = auth[attr];
    }
  }
  
  var key = options.key || null;
  if (key && typeof key == "string") {
    key = {location: key};
  }
  
  if (!key && (options.passphrase || options.keyContents || !options.pass)) {
    key = {};
  }
  
  if (key) {
    key.contents   = key.contents || options.keyContents;
    key.passphrase = key.passphrase || options.passphrase;
    key.location   = key.location || ["~/.ssh/id_rsa", "/.ssh/id_rsa", "~/.ssh/id_dsa", "/.ssh/id_dsa"];
    
    if (!util.isArray(key.location)) {
      key.location = [key.location];
    }
    
    if (key.location) {
      var home = process.env.HOME || process.env.USERPROFILE;
      for (var i = 0; i < key.location.length; i++) {
        if (key.location[i].substr(0, 2) === '~/') {
          key.location[i] = path.resolve(home, key.location[i].replace(/^~\//, ""));
        }
      }
      for (var i = 0, keyPath; keyPath = key.location[i++];) {
        if (fs.existsSync(keyPath)) {
          key.contents = fs.readFileSync(keyPath);
          break;
        }
      }
    } else if (!key.contents) {
      throw new gutil.PluginError('gulp-vsftp', 'Cannot find RSA key, searched: ' + key.location.join(', '));
    }
  }
  
  var logFiles   = !options.logFiles;
  var mkDirCache = {};
  var finished   = false;
  var vsftpCache = null;       //sftp connection cache
  var con        = null;              //ssh connection
  var hasInitPath= false;
  
  var tryClean     = function (con, uploader) {
    if (homePath && remotePlatform == 'unix') {
      var exe = 'rm -rf ' + homePath + '**';
      if (options.ignoreCleanPath) {
        options.ignoreCleanPath = options.ignoreCleanPath.replace(/\/$/, '');
        exe                     = 'find ' + homePath + ' -path "' + homePath + options.ignoreCleanPath + '" -prune -o -type f -exec rm -rf {} \\;'
      }
      con.exec(exe, function (err) {
        if (err) {
          gutil.log(gutil.colors.red("clean " + homePath + " error: " + err));
          return con.end();
        }
        setTimeout(function () {
          gutil.log(gutil.colors.green(homePath + '** clean success!'));
          uploader(vsftpCache);
        }, 1500)
      })
    } else {
      uploader(vsftpCache);
    }
  };
  var initHomePath = function (con, vsftp, uploader) {
    hasInitPath = true;
    vsftp.exists(remotePath, function (err) {
      if (!err) {
        vsftp.mkdir(remotePath, {mode: '0755'}, function (err) {
          console.log(remotePath)
          if (err) {
            throw new Error('VSFTP error: ' + gutil.colors.red(err + " " + remotePath));
          } else {
            tryClean(con, uploader);
            gutil.log('VSFTP home path Created:', gutil.colors.green(remotePath));
          }
        });
      } else {
        tryClean(con, uploader);
      }
    });
  };
    
  var pool = function (remotePath, uploader) {
    if (vsftpCache) {
      return uploader(vsftpCache);
    }
    if (options.pass) {
      gutil.log('Authenticating with password.');
    } else if (key) {
      gutil.log('Authenticating with private key.');
    }
    
    con      = new SSH2();
    var self = this;
    con.on('ready', function () {
      gutil.log(gutil.colors.green('connection ready!'));
      con.sftp(function (err, sftp) {
        if (err) {
          throw err;
        }
        vsftpCache = sftp;
        if(!hasInitPath){
          initHomePath(con, vsftpCache, uploader);
        } else {
          uploader(vsftpCache);
        }
        sftp.on('end', function () {
          gutil.log('VSFTP :: VSFTP session closed');
          vsftpCache = null;
          if (!finished) {
            self.emit('error', new gutil.PluginError('gulp-vsftp', "VSFTP abrupt closure"));
          }
        });
      });
    });
    con.on('error', function (err) {
      self.emit('error', new gutil.PluginError('gulp-vsftp', err));
    });
    con.on('end', function () {
      gutil.log('Connection :: end');
    });
    con.on('close', function (had_error) {
      if (!finished) {
        self.emit('error', new gutil.PluginError('gulp-vsftp', "VSFTP abrupt closure"));
      }
      gutil.log('Connection :: close', had_error !== false ? "with error" : "");
      if (options.callback) options.callback();
    });
    
    
    var conOpt = {
      host    : options.host,
      port    : options.port || 22,
      username: options.user
    };
    if (options.pass) {
      conOpt.password = options.pass;
    } else if (options.agent) {
      conOpt.agent        = options.agent;
      conOpt.agentForward = options.agentForward || false;
    } else if (key) {
      conOpt.privateKey = key.contents;
      conOpt.passphrase = key.passphrase;
    }
    if (options.timeout) {
      conOpt.readyTimeout = options.timeout;
    }
    con.connect(conOpt);
  };
  
  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      this.push(file);
      return cb();
    }
    var finalRemotePath = normalizePath(path.join(remotePath, file.relative));
    pool.call(this, finalRemotePath, function (sftp) {
      var self     = this;
      var dirname  = path.dirname(finalRemotePath);
      var fileDirs = parents(dirname)
        .map(function (d) {
          return normalizePath(d.replace(/^\/~/, "~"));
        });
      
      if (dirname.search(/^\//) === 0) {
        fileDirs = fileDirs.map(function (dir) {
          if (dir.search(/^\//) === 0) {
            return dir;
          }
          return '/' + dir;
        });
      }
      
      //get filter out dirs that are closer to root than the base remote path
      //also filter out any dirs made during this gulp session
      fileDirs = fileDirs.filter(function (d) {
        return d.length >= remotePath.length && !mkDirCache[d];
      });
      
      //while there are dirs to create, create them
      //https://github.com/caolan/async#whilst - not the most commonly used async control flow
      async.whilst(function () {
        return fileDirs && fileDirs.length;
      }, function (next) {
        var d         = fileDirs.pop();
        mkDirCache[d] = true;
        if (remotePlatform && remotePlatform.toLowerCase().indexOf('win') !== -1) {
          d = d.replace('/', '\\');
        }
        sftp.exists(d, function (err) {
          if (!err) {
            sftp.mkdir(d, {mode: '0755'}, function (err) {
              if (err) {
                gutil.log('VSFTP error: ', gutil.colors.red(err + " " + d));
              } else {
                gutil.log('VSFTP Created:', gutil.colors.green(d));
              }
            });
          }
          next();
        })
      }, function () {
        
        var stream = sftp.createWriteStream(finalRemotePath, {//REMOTE PATH
          flags    : 'w',
          encoding : null,
          mode     : '0666',
          autoClose: true
        });
        
        var uploadedBytes = 0;
        var highWaterMark = stream.highWaterMark || (16 * 1000);
        
        file.pipe(stream); // start upload
        
        stream.on('drain', function () {
          uploadedBytes += highWaterMark;
          gutil.log('gulp-vsftp:', finalRemotePath, "uploaded", (uploadedBytes / 1000) + "kb");
        });
        
        stream.on('close', function (err) {
          if (err) {
            self.emit('error', new gutil.PluginError('gulp-vsftp', err));
          }
          else {
            if (logFiles) {
              gutil.log('gulp-vsftp:', gutil.colors.green('Uploaded: ') +
                file.relative +
                gutil.colors.green(' => ') +
                finalRemotePath);
            }
            fileCount++;
          }
          return cb(err);
        });
        
      });
    });
    this.push(file);
  }, function (cb) {
    if (fileCount > 0) {
      gutil.log('gulp-vsftp:', gutil.colors.green('files uploaded successfully'));
    } else {
      gutil.log('gulp-vsftp:', gutil.colors.yellow('No files uploaded'));
    }
    finished = true;
    if (vsftpCache) {
      vsftpCache.end();
    }
    if (con) {
      con.end();
    }
    cb();
  });
};
