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
var md5 = require("blueimp-md5").md5;


var PeggyBoard = function() {
    this.initialize_buffer(160, 12);
};
PeggyBoard.prototype = {
    _buffer: null,
    _colorBuffer: null,
    server: null,
    initialize_buffer: function(width, height) {
        this._buffer = new Array(height);
        this._colorBuffer = new Array(height);
        this._width = width;
        this._height = height;

        //initialize our buffer
        for(var i=0; i< height; i++ ) {
            this._buffer[i] = new Array(width);
            this._colorBuffer[i] = new Array(width);
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

        var i = col;
        var cc = 29;
        while (msg.length) {
            var code = msg[0].charCodeAt(0);
            if (code >= 29 && code <= 31) {
                cc = code;
            } else {
                this._colorBuffer[row][i] = cc;
                this._buffer[row][i++] = msg[0];
            }
            msg = msg.substring(1);
        }

        this.onBoardUpdated();
        return true;
    },
    raw_buffer: function() {
        return this._buffer;
    },
    raw_color_buffer: function() {
        return this._colorBuffer;
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
    term = Math.max(1, Math.min(10 * 60, term));

    this.end_date = new Date();

    this.term = term;
    this.end_date.setSeconds( this.end_date.getSeconds() + term );
    console.log("Lease Will Expire On "+ this.end_date);
    var lease_code = md5((new Date().getTime()));
    this.board_lease_code = lease_code; //Number(new Date()) + '';
};


PeggyLease.prototype = {
    end_date: null,
    board_lease_code: null,
    is_expired: function() {
        var current_time = new Date();
        var remaining_time = this.end_date.getTime()-current_time.getTime();
        console.log("Remaining Lease Time " + remaining_time);
        return ((!this.end_date) || (remaining_time < 0));
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
                colors: null,
                buffer: null,
                stamp: new Date(),
                error: "Timed out"
            });
        }, 10000);

        this._board.server.once("updated", function() {
            clearTimeout(expiredTimer);
            callback({
                buffer: b.raw_buffer(),
                colors: b.raw_color_buffer(),
                height:b.height(),
                width:b.width(),
                stamp: new Date()
            });
        });
    },

    bufferState: function() {
        var b = this._board;
        return {
            buffer: b.raw_buffer(),
            colors: b.raw_color_buffer(),
            height:b.height(),
            width:b.width(),
            stamp: new Date()
        };
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

    expire_lease: function(lease) {
        this._lease = null;
        return { result:true };
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
    this.get(/^expire_lease\/(\w+)$/).bind(function(req, res, lease) {
        var result = logic.expire_lease(lease);
        res.send(200, {}, result);
    })


    this.get(/^clear\/(\d+)$/).bind(function(req, res, lease_code) {
        res.send(200, {}, logic.clear_board(lease_code));
    });
    this.get(/^clear\/(\d+)\/(\w+)$/).bind(function(req, res, lease_code, row) {
        res.send(200, {}, logic.clear_board(lease_code, row));
    });

    this.get(/^set_color\/(\w+)\/([0-9]+)$/).bind(function(req, res, lease_code, color) {
        res.send(200, {}, logic.set_color(lease_code, color));
    });

    this.get(/^write\/(\w+)\/([0-9]+)\/([0-9]+)\/([^\n]+)$/).bind(function (req, res, lease_code, row, col, msg) {
        msg = decodeURIComponent(msg);
        res.send(200, {}, logic.write_to_board(lease_code, row, col, msg));
    });
    this.post(/^write\/(\w+)\/([0-9]+)\/([0-9]+)\/([^\n]+)$/).bind(function (req, res, lease_code, row, col, msg) {
        msg = decodeURIComponent(msg);
        res.send(200, {}, logic.write_to_board(lease_code, row, col, msg));
    });

    this.get(/^buffer$/).bind(function (req, res) {
        res.send(200, {}, logic.render_buffer());
    });

    this.get(/^bufferState/).bind(function (req, res) {
         res.send(200, {}, logic.bufferState());
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
            console.log('something ' + request.url)

            if (result.status === 404) {
                sys.puts("Router didn't find request for request.url");
                files.serve(request, response, function (err, result) {
                    // If the file wasn't found
                    if (err && (err.status === 404)) {
                        response.writeHead(404);
                        response.end('File not found. ' + request.url);
                    }
                });
                return;
            }


            response.writeHead(result.status, result.headers);
            response.end(result.body);
        });
    });
}).listen(8080);