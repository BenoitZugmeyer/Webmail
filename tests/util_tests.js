
var util = require('../util')
  , assert = require('assert');


[
  [
    'nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan nyan',
    '=?utf-8?Q?nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_=\r\nnyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_=\r\nnyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_=\r\nnyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_nyan_=\r\nnyan_nyan_nyan_nyan_nyan_nyan?=',
    '=?utf-8?B?bnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4gbnlhbiBueWFuIG55YW4=?='
  ],
  [
    'Bonjour Benoît comment ça va ?',
    '=?utf-8?Q?Bonjour_Beno=C3=AEt_comment_=C3=A7a_va_=3F?=',
    '=?utf-8?B?Qm9uam91ciBCZW5vw650IGNvbW1lbnQgw6dhIHZhID8=?='
  ],
  [
    '¡Hola, señor!',
    '=?utf-8?Q?=C2=A1Hola,_se=C3=B1or!?=',
    '=?utf-8?B?wqFIb2xhLCBzZcOxb3Ih?='
  ],
  [
    '的是不了',
    '=?utf-8?Q?=E7=9A=84=E6=98=AF=E4=B8=8D=E4=BA=86?=',
    '=?utf-8?B?55qE5piv5LiN5LqG?='
  ]
].forEach(function(a, i) {
  assert.equal(util.ew_encode(a[0]), a[1], 'Quoted encode case ' + i);
  assert.equal(util.ew_decode(a[1]), a[0], 'Quoted decode case ' + i);
  assert.equal(util.ew_encode(a[0], 'B'), a[2], 'Base64 encode case ' + i);
  assert.equal(util.ew_decode(a[2]), a[0], 'Base64 decode case ' + i);
});


console.log('OK');

