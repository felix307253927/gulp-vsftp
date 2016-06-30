# [gulp](http://gulpjs.com)-vsftp

> Upload files via SSH



[![NPM](https://nodei.co/npm/gulp-vsftp.png?downloads=true&stars=true)](https://nodei.co/npm/gulp-vsftp/)

## Install

```bash
$ npm install --save-dev gulp-vsftp  or
$ npm install --save-dev https://github.com/felix307253927/gulp-vsftp.git
```


## Usage

```js
var gulp = require('gulp');
var vsftp = require('gulp-vsftp');

gulp.task('default', function () {
	return gulp.src('src/*')
		.pipe(vsftp({
			host: 'website.com',
			user: 'root',
			pass: 'root',
			cleanFiles: true,
			remotePath: '/home/',
			ignoreCleanPath: 'zip' //  /home/zip  will not be cleared
		}));
});
```


## API

### vsftp(options)

#### options.host

*Required*  
Type: `String`

#### options.port

Type: `Number`  
Default: `22`

#### options.user

Type: `String`  
Default: `'root'`

#### options.pass

Type: `String`  
Default: `null`

If this option is not set, gulp-vsftp assumes the user is using private key authentication and will default to using keys at the following locations:

`~/.ssh/id_dsa` and `/.ssh/id_rsa`

If you intend to use root login, use the value '@root'.

#### options.cleanFiles

Type: `Boolean`  
Default: `false`
If you set true, remote files will be delete(only suports linux now).

#### options.ignoreCleanPath

Type: `String`  
Default: ``
If options.cleanFiles is true and you set ignoreCleanPath(can't endwith `/`) ,this path will not delete.

#### options.remotePath

Type: `String`  
Default: `'/'`

The remote path to upload to(must endwith `/`). If this path does not yet exist, it will be created, as well as the child directories that house your files.

#### options.remotePlatform

Type: `String`
Default: `'unix'`

The remote platform that you are uploading to. If your destination server is a Windows machine, use the value `windows`.

#### options.key

type `String` or `Object`
Default: `null`

A key file location. If an object, please use the format `{location:'/path/to/file',passphrase:'secretphrase'}`


#### options.passphrase

type `String`
Default: `null`

A passphrase for secret key authentication. Leave blank if your key does not need a passphrase.

#### options.keyContents

type `String`
Default: `null`

If you wish to pass the key directly through gulp, you can do so by setting it to options.keyContents.

#### options.auth

type `String`
Default: `null`

An identifier to access authentication information from `.ftppass` see [Authentication](#authentication) for more information.

#### options.authFile

type `String`
Default: `.ftppass`

A path relative to the project root to a JSON formatted file containing auth information.

#### options.timeout
type `int`
Default: Currently set by ssh2 as `10000` milliseconds.

An integer in milliseconds specifying how long to wait for a server response.

#### options.agent
type `String`
Default: `null`

Path to ssh-agent's UNIX socket for ssh-agent-based user authentication.

#### options.agentForward
type `bool`
Default: `false`

Set to true to use OpenSSH agent forwarding. Requires that `options.agent` is configured.

#### options.callback
type `function`
Default: `null`

Callback function to be called once the SFTP connection is closed.


##Authentication

For better security, save authentication data in a json formatted file named `.ftppass` (or to whatever value you set options.authFile to). **Be sure to add this file to .gitignore**. You do not typically want auth information stored in version control.

```js
var gulp = require('gulp');
var vsftp = require('gulp-vsftp');

gulp.task('default', function () {
	return gulp.src('src/*')
		.pipe(vsftp({
			host: 'website.com',
			auth: 'keyMain'
		}));
});
```

`.ftppass`

```json
{
  "keyMain": {
    "user": "username1",
    "pass": "password1"
  },
  "keyShort": "username1:password1",
  "privateKey": {
    "user": "username"
  },
  "privateKeyEncrypted": {
    "user": "username",
    "passphrase": "passphrase1"
  },
  "privateKeyCustom": {
    "user": "username",
    "passphrase": "passphrase1",
    "keyLocation": "/full/path/to/key"
  }
}
```

## License

[MIT](http://opensource.org/licenses/MIT)

