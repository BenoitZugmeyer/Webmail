var ew_re = /^=\?([\w-]+)\?([QB])\?((?:.|[\r\n])+)\?=$/
  , ew_supportedEncoding = ['utf-8', 'utf8', 'ucs2', 'ucs-2', 'hex', 'ascii',
      'binary', 'base64'];


/*
  ew_decode

  Decode MIME Encoded-Word strings.

  Encoded-Word strings are of the form "=?charset?encoding?encoded text?=". If
  the string does not match this pattern, the original string is returned
  untouched. Else, the encoded text is returned decoded in a standard utf8
  string.

  Important note: node does not support other charsets than utf8.

  More informations:
    * https://secure.wikimedia.org/wikipedia/en/wiki/MIME#Encoded-Word
    * http://tools.ietf.org/html/rfc2047
*/
var ew_decode = exports.ew_decode = function (str) {
  var match = str.match(ew_re);
  if(!match) { return str; }
  var encoding = match[1].toLowerCase()
    , type = match[2]
    , buffer;

  str = match[3];
  if(ew_supportedEncoding.indexOf(encoding) === -1) {
    // Node supports only utf-8 encoding 
    encoding = 'utf-8';
  }
  if(type === 'Q') {
    // Quoted encoding
    // Decode string to ascii
    str = match[3]
      .replace(/=\r\n/gm, '')
      .replace(/_/g, ' ')
      .replace(/=([0-9A-F]{2})/gim, function (sMatch, sHex) {
        return String.fromCharCode(parseInt(sHex, 16));
      });
    // Encode it to UTF-8
    buffer = new Buffer(str, 'ascii');
  }
  else {
    // Base64 encoded
    // Encode string to UTF-8
    buffer = new Buffer(str, 'base64');
  }
  return buffer.toString(encoding);
}


/*
  ew_encode

  Encode string to MIME Encoded-Word.

  It will return a string of the form "=?charset?encoding?encoded text?=". The
  optionnal second parametter could be either Q (the default) or B to use a
  specific encoding.

  Note: for now, charset will always be utf8 as node does not support other
  charset.

  More informations:
    * https://secure.wikimedia.org/wikipedia/en/wiki/MIME#Encoded-Word
    * http://tools.ietf.org/html/rfc2047
*/
var ew_encode = exports.ew_encode = function (str, encoding) {
  if(!encoding) { encoding = 'Q'; }
  var buffer = new Buffer(str, 'utf8')
    , result;

  if(encoding === 'Q') {
    // Quoted encoding
    var i, l, code
      , result = ''
      , toAdd
      , rl;
    // Decode string to binary (each char has a code between 0 and 255)
    str = buffer.toString('binary');
    for(i = 0, l = str.length; i < l; i += 1) {
      code = str.charCodeAt(i);
      if(code > 127 || code === 61 /*=*/ || code === 63 /*?*/ ||
         code === 95 /*_*/ || code === 9 /* tab */ )
      {
        // Encode non-basic ASCII characters and some special ones
        toAdd = '=' + code.toString(16).toUpperCase();
      }
      else if(code === 32 /* space */) {
        // Replace spaces by underscore
        toAdd = '_';
      }
      else {
        // Add the character
        toAdd = str[i];
      }
      // Cut the result every 73 characters so the lines are no longer than 76
      // characters
      rl = result.length + 12;
      if((rl / 73 | 0) !== ((rl + toAdd.length) / 73 | 0)) {
        result += '=\r\n';
      }
      result += toAdd;
    }
  }
  else {
    // Base64 encoding
    result = buffer.toString('base64');
  }
  return '=?utf-8?' + encoding + '?' + result + '?=';
}

