var fs = require('fs')
  , Step = require('step')
  , mongo = require('mongoskin')
  , ImapConnection = require('imap').ImapConnection;

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
    , messages = [];
  fetcher.on('message', function (msg) {
    msg.on('end', function () {
      messages.push(msg);
    })
  });
  fetcher.on('end', function () {
    callback(null, messages);
  });
}

function log (message) {
  console.log('//', message);
}


// cf: https://github.com/rgrove/larch/blob/master/lib/larch.rb
//     https://github.com/rgrove/larch/blob/master/lib/larch/imap/mailbox.rb
function sync (box_name) {
  var imapMailbox
    , dbMailbox
    , imap
    , db = mongo.db('localhost/mail?auto_reconnect');
  Step(
    function () {
      log('Connection');

      Step(
        function () { getCredentials(this); },
        function (e, username, password) {
          error(e);
          imap = new ImapConnection({
            username: username,
            password: password,
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            debug: function(s) {
              //  console.log(s.trim().replace('<<RECEIVED>>', '-->').replace('<<SENT>>', '<--'));
            }
          });
          imap.connect(this);
        },
        function (e) { error(e); imap.openBox(box_name, true, this); },
        this.parallel()
      );

      db.collection('mailboxes').findOne({name: box_name}, this.parallel());
    },
    function (e, imapMailbox_, dbMailbox_) {
      imapMailbox = imapMailbox_;
      dbMailbox = dbMailbox_;
      log('Retrieve infos');
      error(e);
      var add = this.parallel()
        , update = this.parallel();
      if(dbMailbox && dbMailbox.uidnext && dbMailbox.validity === imapMailbox.validity) {
        if(dbMailbox.uidnext === imapMailbox.uidnext) {
          add(); // nothing to add
        }
        else {
          log('Fetch mails to add');
          fetch(imap,
                dbMailbox.uidnext + ':' + imapMailbox.uidnext,
                {},
                add);
        }
        log('Fetch mails to update');
        fetch(imap,
              '1:' + dbMailbox.uidnext,
              { request: { struct: false, headers: false } },
              update);
      }
      else {
        update(); // nothing to update
        if(dbMailbox) {
          log('Remove all messages');
          db.collection('mails').remove(
            {mailbox: db.db.bson_serializer.ObjectID.createFromHexString(dbMailbox._id)},
            this.parallel());
            db.collection('mailboxes').updateById(dbMailbox._id, { $set: { validity: imapMailbox.validity } }, this.parallel());
        }
        else {
          db.collection('mailboxes').insert({name: box_name, validity: imapMailbox.validity}, this.parallel());
        }
        log('Download all messages');
        fetch(imap,
              '1:' + imapMailbox.uidnext,
              {},
              add);
      }
    },

    function (e, add, update) {
      error(e);
      if(add && add.length) {
        log('Add new mails to database');
        add.forEach(function (mail) {
          console.log(mail.headers.subject && mail.headers.subject[0]);
        });
        //      console.log(add);
        db.collection('mailboxes').updateById(dbMailbox._id, { $set: { uidnext: imapMailbox.uidnext } });
      }
      if(update && update.length) {
        log('Update mails of database');
        //      console.log(update);
      }
      this();
    },

    function (e) {
      log('Close connections');
      error(e);
      imap.logout(this);
      db.close();
    },

    function (e) {
      log('End');
      error(e);
    }
  );
}

sync('INBOX');

