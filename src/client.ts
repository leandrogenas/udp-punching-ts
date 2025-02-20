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

let porta;
let punched = false;
let brutos = 0;
let pingPongs = {
  rx: 0,
  tx: 0
};

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
    
    //for (var con in parsed.client.connections) {
      doUntilAck(1000, function() {
        if(punched)
          parsed.client.connections.public.port = porta;
        send(parsed.client.connections.public, punch);
      });
    //}
  } else if (parsed.type == 'punch' && parsed.to == clientName) {
    var ack = { type: 'ack', from: clientName };  
    console.log("# got punch, sending ACK");
    porta = rinfo.port
    punched = true;
    console.log(porta)
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
    send({address: rinfo.address, port: rinfo.port}, {type: 'ping', from: clientName, to: remoteName})
    console.log('> %s [from %s@%s:%s]', parsed.msg, parsed.from, rinfo.address, rinfo.port)
  } else if (parsed.type == 'ping') {
    const conn = {port: porta, ...client.connection}
    SendAfterDelay(conn, {type: 'pong', from: clientName, to: remoteName})
    pingPongs.rx++;
    console.log('> pong');
    console.log(`< ping, recebidos: ${pingPongs.rx}, enviados: ${pingPongs.tx}`);

    if(pingPongs.rx % 10 === 0){
      console.log('> brutalizando...');
      for(let i=0; i<10000; i++)
        send(conn, {type: 'bruto', from: clientName, to: remoteName}, () => {
          console.log('= brutalizado')
        })
    }
  } else if (parsed.type == 'pong') {
    const conn = {port: porta, ...client.connection}
    SendAfterDelay(conn, {type: 'ping', from: clientName, to: remoteName})
    pingPongs.tx++;
    console.log(`< ping, recebidos: ${pingPongs.rx}, enviados: ${pingPongs.tx}`);
  } else if (parsed.type == 'bruto'){
    console.log(`= brutos: ${++brutos}`)
  }

});

const SendAfterDelay = (conn, msg, t = 1000) => setTimeout(() => send(conn, msg), t);

var doUntilAck = function(interval, fn) {
  if (client.ack) return;
  fn();
  setTimeout(function() {
    doUntilAck(interval, fn);
  }, interval);  
}

udp_in.bind();
