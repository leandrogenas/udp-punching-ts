import * as dgram from 'dgram'
import * as net from 'net'
import { ClientInfo, TransmittedData } from '.';

var clientName = process.argv[3];
var remoteName = process.argv[4];

var rendezvous = {
  address: process.argv[2],
  port: 6312
} as net.AddressInfo;

var client = {
  ack: false,
  connection: {}
} as ClientInfo;



var udp_in = dgram.createSocket('udp4');

var getNetworkIP = function(callback) {
  var socket = net.createConnection(80, rendezvous.address);
  socket.on('connect', function() {
    const sockInfo = socket.address() as net.AddressInfo;
    callback(undefined, sockInfo.address);
      socket.end();
  });
  socket.on('error', function(e) {
    callback(e, 'error');
  });
}

var send = function(connection, msg, cb = undefined) {
  var data = Buffer.from(JSON.stringify(msg));

  udp_in.send(data, 0, data.length, connection.port, connection.address, function(err, bytes) {
    if (err) {
      udp_in.close();
      console.log('# stopped due to error: %s', err);
    } else {
      console.log('# sent %s to %s:%s', msg.type, connection.address, connection.port);
      if (cb) cb();
    }
  });
}

udp_in.on("listening", function() {
  let lInfo = { port: udp_in.address().port } as net.AddressInfo;
  getNetworkIP(function(error, ip) {
    if (error) return console.log("! Unable to obtain connection information!");
    lInfo.address = ip;
    console.log('# listening as %s@%s:%s', clientName, lInfo.address, lInfo.port);
    send(rendezvous, { type: 'register', name: clientName, lInfo: lInfo }, function() {
      if (remoteName) {
        send(rendezvous, { type: 'connect', from: clientName, to: remoteName });
      }
    });
  });
});

udp_in.on('message', function(data, rinfo) {
  let parsed: TransmittedData;
  try {
    parsed = JSON.parse(Buffer.from(data).toString());
  } catch (e) {
    console.log('! Couldn\'t parse data(%s):\n%s', e, data);
    return;
  }
  if (parsed.type == 'connection') {
    console.log('# connecting with %s@[%s:%s | %s:%s]', parsed.client.name,
    parsed.client.connections.local.address, parsed.client.connections.local.port, parsed.client.connections.public.address, parsed.client.connections.public.port);
    remoteName = parsed.client.name;
    var punch = { type: 'punch', from: clientName, to: remoteName };
    for (var con in parsed.client.connections) {
      doUntilAck(1000, function() {
        send(parsed.client.connections[con], punch);
      });
    }
  } else if (parsed.type == 'punch' && parsed.to == clientName) {
    var ack = { type: 'ack', from: clientName };  
    console.log("# got punch, sending ACK");
    send(rinfo, ack);
  } else if (parsed.type == 'ack' && !client.ack) {
    client.ack = true;
    client.connection = rinfo;
    console.log("# got ACK, sending MSG");
    send(client.connection, {
      type: 'message',
      from: clientName,
      msg: 'Hello World, '+remoteName+'!' 
    });
  } else if (parsed.type == 'message') {
    console.log('> %s [from %s@%s:%s]', parsed.msg, parsed.from, rinfo.address, rinfo.port)
  } 
});


var doUntilAck = function(interval, fn) {
  if (client.ack) return;
  fn();
  setTimeout(function() {
    doUntilAck(interval, fn);
  }, interval);  
}

udp_in.bind();
