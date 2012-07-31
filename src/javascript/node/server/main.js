/**
 * Created with PyCharm.
 * User: David
 * Date: 7/17/12
 * Time: 10:07 PM
 * To change this template use File | Settings | File Templates.
 */

var journey = require('journey'),
    static = require('node-static'),
    files = new (static.Server)('./static'),
    sys = require('sys');


var PeggyBoard = function() {
    this.initialize_buffer(160, 12);
};
PeggyBoard.prototype = {
    _buffer: null,
    server: null,
    initialize_buffer: function(width, height) {
        this._buffer = new Array(height);
        this._width = width;
        this._height = height;

        //initialize our buffer
        for(var i=0; i< height; i++ ) {
            this._buffer[i] = new Array(width);
        }

        var eventsType = require('events').EventEmitter;
        if (this.server) {
            this.server.emit("updated");
        }
        this.server = new eventsType();
    },
    onBoardUpdated: function() {
        this.server.emit("updated");
    },

    width: function() { return this._width; },
    height: function() { return this._height; },

    clear_board:function(row) {
        if ((row !== 0) && (!row)) {
            //wipe everything.
            this.initialize_buffer(this._width, this._height);
        }
        else if ((row >= 0) && (row < this._height)) {
            //just wipe that row
            this._buffer[row] = new Array(this._width);
        }

        this.onBoardUpdated();
    },
    write_to_board:function (row, col, msg) {
        if ((row !== 0) && (!row)) { row = 0; }
        if ((col !== 0) && (!col)) { col = 0; }

        var i=0;
        for(var r=row;r<this._height;r++) {
            for(var c=col;c<this._width;c++) {
                this._buffer[r][c] = msg[i];
                i++;
            }
        }
        this.onBoardUpdated();
        return true;
    },
    raw_buffer: function() {
        return this._buffer;
    },
    render_buffer: function() {
        var b = this._buffer;
        var result = '';
        for(var r=0;r< b.length;r++ )
        {
            var chars = b[r].map(function(c) { return (c) ? c : ''; });
            var line = chars.join('');
            result += line + '\r\n';
        }
        return result;
    },
    render_buffer_html: function() {
        var b = this._buffer;
        var result = '';
        for(var r=0;r< b.length;r++ )
        {
            var chars = b[r].map(function(c) {
                if (!c) { return ''; }
                //TODO: Colors!
//                var code = c.charCodeAt();
//                if ((code >= 29) && (code <= 31)) {
//                    return "<span style='color:green'>"+c+"</span>";
//                }
                return c;
            });
            var line = chars.join('');
            result += line + '\r\n';
        }
        return result;
    },
    foo:'bar'
};


var PeggyLease = function(term) {
    //TODO: make constants
    //no more than 10 minutes, no less than 1 minute
    term = Math.max(1, Math.min(10, term));

    this.term = term;
    this.end_date = new Date() + term;
    this.board_lease_code = '12345'; //Number(new Date()) + '';

    //TODO: generate live 'lease codes' ?
    //m = md5.new()
    //m.update(unicode(datetime.now().microsecond.__str__))
    //lease_code = m.hexdigest()
    //lease_expiry = datetime.now() + timedelta(seconds=term * 60)
};
PeggyLease.prototype = {
    end_date: null,
    board_lease_code: null,
    is_expired: function() {
        //TODO: make working expiration code?  or... does it matter here?
        return false;
//        return (!this.end_date) || ((new Date()) > this.end_date);
    },
    current_color: String.fromCharCode(29)
};

var PeggyLogic = function() {
    this._board = new PeggyBoard();
};
PeggyLogic.prototype = {
    _lease: null,
    _board: null,

    render_buffer: function() {
        return this._board.render_buffer();
    },

    bufferPolling: function(callback) {
        var b = this._board;

        var expiredTimer = setTimeout(function() {
            callback({
                buffer: null,
                stamp: new Date(),
                error: "Timed out"
            });
        }, 10000);

        this._board.server.once("updated", function() {
            clearTimeout(expiredTimer);
            callback({
                buffer: b.raw_buffer(),
                height:b.height(),
                width:b.width(),
                stamp: new Date()
            });
        });

    },

    has_lease: function() {
        return ((this._lease != null) && (!this._lease.is_expired()));
    },

    get_current_lease: function(lease_code) {
        if (this.has_lease()) {
            if (this._lease.board_lease_code == (lease_code + '')) {
                return this._lease;
            }
        }
        return null;
    },

//    get_lease
    create_lease: function(term) {
        if (this.has_lease()) {
            return {
                result: 'failure',
                reason_code: 'in_use'
            };
        }

        this._lease = new PeggyLease(term);
        return {
            result: 'success',
            lease_code: this._lease.board_lease_code,
            lease_expiry: this._lease.end_date
        }
    },

    clear_board: function(lease_code, row) {
        if (!this.get_current_lease(lease_code)) {
            return { result: 'failure', reason_code: 'bad_lease_code ' + lease_code };
        }
        else {
            this._board.clear_board(row);
            return { result: 'success'  };
        }
    },

    write_to_board: function(lease_code, row, col, msg) {
        if (!this.get_current_lease(lease_code)) {
            return { result: 'failure', reason_code: 'bad_lease_code' };
        }
        else {
            this._board.write_to_board(row, col, this._lease.current_color + msg);
            return { result: 'success' };
        }
    },


    set_color: function(lease_code, color) {
        if (!this.get_current_lease(lease_code)) {
            return { result: 'failure', reason_code: 'bad_lease_code' };
        }
        else {
            switch (color) {
                case 'green':
                    this._lease.current_color = String.fromCharCode(29);
                    break;
                case 'red':
                    this._lease.current_color = String.fromCharCode(30);
                    break;
                case 'orange':
                    this._lease.current_color = String.fromCharCode(31);
                    break;
                default:
                    return { result: 'failure', reason_code: 'unknown_color' };
            }
            return { result: 'success' };
        }
    },

    foo: 'bar'
};



//
// Create a Router
//
var router = new(journey.Router);
var logic = new PeggyLogic();

// Create the routing table
router.map(function () {
    this.root.bind(function (req, res) {
        res.send("It's your own personal litebrite!" +
            "Point your client peggy url to this url!")
    });

    this.get ("get_lease").bind(function(req, res) {
        var result = logic.create_lease();
        res.send(200, {}, result);
    });
    this.get (/^get_lease\/([0-9]+)$/).bind(function(req, res, term) {
        var result = logic.create_lease(term);
        res.send(200, {}, result);
    });


    this.get(/^clear\/(\d+)$/).bind(function(req, res, lease_code) {
        res.send(200, {}, logic.clear_board(lease_code));
    });
    this.get(/^clear\/(\d+)\/([0-9]+)$/).bind(function(req, res, lease_code, row) {
        res.send(200, {}, logic.clear_board(lease_code, row));
    });

    this.get(/^set_color\/([0-9]+)\/([0-9]+)$/).bind(function(req, res, lease_code, color) {
        res.send(200, {}, logic.set_color(lease_code, color));
    });

    this.get(/^write\/([0-9]+)\/([0-9]+)\/([0-9]+)\/([a-z]+)$/).bind(function (req, res, lease_code, row, col, msg) {
        res.send(200, {}, logic.write_to_board(lease_code, row, col, msg));
    });
    this.post(/^write\/([0-9]+)\/([0-9]+)\/([0-9]+)\/([a-z]+)$/).bind(function (req, res, lease_code, row, col, msg) {
        res.send(200, {}, logic.write_to_board(lease_code, row, col, msg));
    });

    this.get(/^buffer$/).bind(function (req, res) {
        res.send(200, {}, logic.render_buffer());
    });

    this.get(/^bufferPolling/).bind(function (req, res) {

        logic.bufferPolling(function(data) {
            res.send(200, {}, data);
        });


    });



    //TODO? :
    //url(r'^peggy/set_color$', 'sign_server.peggy.set_color'),
    //url(r'^peggy/write$', 'sign_server.peggy.write_to_board'),
    //    this.get("clear").bind(function(req, res) {
    //        res.send(200, {}, logic.clear_board());
    //    });


    this.get(/^thisIsAnID\/([0-9]+)$/).bind(function (req, res, id) {
        res.send(200, {}, {
            id: id,
            msg: "I guess this is an object..."
        });
    });

});


require('http').createServer(function (request, response) {
    var body = "";
    request.addListener('data', function (chunk) { body += chunk });
    request.addListener('end', function () {
        //
        // Dispatch the request to the router
        //
        router.handle(request, body, function (result) {

            if (result.status === 404) {
                sys.puts("Router didn't find request for request.url");
                files.serve(request, response, function (err, result) {
                    // If the file wasn't found
                    if (err && (err.status === 404)) {
                        response.writeHead(404);
                        response.end('File not found.');
                    }
                });
                return;
            }


            response.writeHead(result.status, result.headers);
            response.end(result.body);
        });
    });
}).listen(8080);