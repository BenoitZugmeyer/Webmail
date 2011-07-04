var fs = require('fs')
  , Step = require('step')
  , mongo = require('mongoskin')
  , ImapConnection = require('imap').ImapConnection
  , util = require('./util');

function getCredentials (callback) {
  fs.readFile(process.env.HOME + '/.netrc', 'UTF8', function (e, data) {
    if(e) { return callback(e); }
    var match = data.match(/machine mail.google.com login (\w+) password (.+)/);
    if(!match) {
      return callback('Could not find the gmail credential in ~/.netrc');
    }
    callback(null, match[1], match[2]);
  });
}

function error (e) {
  if(e) {
    console.log('/!\\ Error:', e);
    console.log(e.stack);
    process.exit(1);
  }
}

function fetch (imap, uids, options, callback) {
  var fetcher = imap.fetch(uids, options)
    , messages = []
    , group = options && options.group !== undefined || 100;

  fetcher.on('message', function (msg) {
    msg.on('end', function () {
      messages.push(msg);
      if(messages.length === group) {
        callback(null, messages, true);
        messages = [];
      }
    })
  });
  fetcher.on('end', function () {
    callback(null, messages, false);
  });
}

function storeMessages (db, mailbox, messages, callback) {
  log('Storing ' + messages.length + ' messages');
  messages = messages.map(function(m) {
    var subject = m.headers.subject && m.headers.subject[0];
    return {
      mailbox: dbId(db, mailbox),
      id: m.id,
      subject: subject && util.ew_decode(subject),
      flags: m.flags
    };
  });
  db.collection('mails').insertAll(messages, callback);
}

function arrayEqual(a, b) {
  if(a === b) { return true; }
  if(!a || !b || a.length !== b.length) { return false; }

  var i, l;
  for(i = 0, l = a.length; i < l; i += 1) {
    if(a[i] !== b[i]) { return false; }
  }
  return true;
}

function updateMessages (db, mailbox, messages, callback) {
  log('Updating ' + messages.length + ' messages');
  Step(
    function() {
      var step = this.parallel(), self = this;
      db.collection('mails').find({ mailbox: dbId(db, mailbox) },
                                  { id: true, flags: true, sort: 'id' })
        .each(function(e, dbMessage) {
          if(e || !dbMessage) { return step(e); }
          var imapMessage = messages[0] || { id: Number.MAX_VALUE };
          if(imapMessage.id === dbMessage.id) {
            if(!arrayEqual(imapMessage.flags, dbMessage.flags)) {
              log('Update flags of ' + dbMessage.id);
              db.collection('mails').updateById(
                dbMessage._id,
                { $set: { flags: imapMessage.flags } },
                self.parallel()
              );
            }
            messages.shift();
          }
          else if(imapMessage.id > dbMessage.id) {
            log('Delete message ' + dbMessage.id);
            db.collection('mails').removeById(dbMessage._id, self.parallel());
          }
          else {
            log('ERROR');
            messages.shift();
          }
        }
      );
    },
    function (e) {
      callback(e, messages.map(function(m) { return m.id; }));
    }
  );
}

function log (message) {
  console.log('//', message);
}

function dbId (db, object) {
  return db.db.bson_serializer.ObjectID.createFromHexString(object._id)
}

// cf: https://github.com/rgrove/larch/blob/master/lib/larch.rb
//     https://github.com/rgrove/larch/blob/master/lib/larch/imap/mailbox.rb
function sync (box_name) {
  var imapMailbox
    , dbMailbox
    , imap
    , make = function (what, step, next) {
        return function (e, messages, more) {
          if(e) { next(e); }
          what(db, dbMailbox, messages, more ? step.parallel() : next);
        };
      }
    , db = mongo.db('localhost/mail?auto_reconnect');
  Step(
    function () {
      log('Connection');

      Step(
        function () {
          getCredentials(this);
        },
        function (e, username, password) {
          error(e);
          imap = new ImapConnection({
            username: username,
            password: password,
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            debug: function(s) {
    //          console.log(s.trim().replace('<<RECEIVED>>', '-->').replace('<<SENT>>', '<--'));
            }
          });
          imap.connect(this);
        },
        function (e) {
          error(e);
          imap.openBox(box_name, true, this);
        },
        this.parallel()
      );

      db.collection('mailboxes').findOne({name: box_name}, this.parallel());
    },
    function (e, imapMailbox_, dbMailbox_) {
      error(e);
      log('Retrieve infos');

      imapMailbox = imapMailbox_;
      dbMailbox = dbMailbox_;
      var self = this
        , update = this.parallel();

      if(dbMailbox && dbMailbox.uidnext &&
         dbMailbox.validity === imapMailbox.validity
        ) {
        if(dbMailbox.uidnext !== imapMailbox.uidnext) {
          log('Fetch mails to add');
          fetch(imap,
                dbMailbox.uidnext + ':' + imapMailbox.uidnext,
                {},
                make(storeMessages, this, this.parallel())
               );
        }
        log('Fetch mails to update');
        fetch(imap,
              '1:' + dbMailbox.uidnext,
              { group: 0, request: { struct: false, headers: false, date: false } },
              make(updateMessages, this, update)
             );
      }
      else {
        var downloadAll = function (e, dbMailbox_) {
          if (dbMailbox_) { dbMailbox = dbMailbox_[0]; }
          update(e, '1:' + imapMailbox.uidnext);
        };

        if(dbMailbox) {
          log('Remove all messages');
          db.collection('mails').remove(
            {mailbox: dbId(db, dbMailbox)},
            this.parallel()
          );
          log('Updating mailbox validity uid');
          db.collection('mailboxes').updateById(
            dbMailbox._id,
            { $set: { validity: imapMailbox.validity } },
            downloadAll
          );
        }
        else {
          log('Create the mailbox');
          db.collection('mailboxes').insert(
            {name: box_name, validity: imapMailbox.validity},
            downloadAll
          );
        }
      }
    },

    function (e, toDownload) {
      if(e || !toDownload || !toDownload.length) { return this(e); }
      log('Download missing emails');
      fetch(imap, toDownload, {}, make(storeMessages, this, this.parallel()));
    },

    function (e) {
      error(e);
      log('Done adding / updating, updating db uidnext');
      db.collection('mailboxes').updateById(
        dbMailbox._id,
        { $set: { uidnext: imapMailbox.uidnext } },
        this
      );
    },

    function (e) {
      error(e);
      log('Close connections');
      imap.logout(this);
      db.close();
    },

    function (e) {
      error(e);
      log('The End');
    }
  );
}

sync('INBOX');

