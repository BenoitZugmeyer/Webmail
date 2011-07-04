var iconv = require('iconv')
  , ew_re_all = /=\?[\w-]+\?[QB]\?(?:.|[\r\n])+?\?=/g
  , window_1252 = [
    '€', '',  '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '',  'Ž', '',
    '',  '‘',  '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '', 'ž', 'Ÿ'
  ];


/*
  ew_decode

  Decode MIME Encoded-Word strings.

  Encoded-Word strings are of the form "=?charset?encoding?encoded text?=". If
  the string does not match this pattern, the original string is returned
  untouched. Else, the encoded text is returned decoded in a standard utf8
  string.

  More informations:
    * https://secure.wikimedia.org/wikipedia/en/wiki/MIME#Encoded-Word
    * http://tools.ietf.org/html/rfc2047
*/
var ew_decode = exports.ew_decode = function (str) {
  return str.replace(ew_re_all, function (str) {
    str = str.split('?');
    var charset = str[1].toLowerCase()
      , encoding = str[2]
      , isutf8 = charset === 'utf-8' || charset ==='utf8'
      , result;

    str = str[3];
    if(encoding === 'Q') {
      // Quoted encoding
      // Decode string to ascii
      str = str
        .replace(/=\r\n/gm, '')
        .replace(/_/g, ' ')
        .replace(/=([0-9A-F]{2})/gim, function (sMatch, sHex) {
          sHex = parseInt(sHex, 16);
          return String.fromCharCode(sHex) || window_1252[sHex - 128]; // Completing iso-8859 table with windows-1252
        });
      // Encode it to UTF-8
      result =
        isutf8 ? new Buffer(str, 'ascii') :
        charset === 'windows-1252' ? str :
          new iconv.Iconv(charset, 'windows-1252//TRANSLIT').convert(str);
    }
    else {
      // Base64 encoded
      // Encode string to UTF-8
      result = new Buffer(str, 'base64');
      if(!isutf8) {
        result = new iconv.Iconv(charset, 'utf-8//TRANSLIT').convert(result);
      }
    }
    return result.toString();
  });
}


/*
  ew_encode

  Encode string to MIME Encoded-Word.

  It will return a string of the form "=?charset?encoding?encoded text?=". The
  optionnal second parametter could be either Q (the default) or B to use a
  specific encoding.

  Note: for now, charset will always be utf8.

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
        toAdd = (code < 16 ? '=0' : '=') + code.toString(16).toUpperCase();
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

