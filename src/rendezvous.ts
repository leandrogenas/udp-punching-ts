import * as dgram from 'dgram'
import { TransmittedData, ServerInfo } from '.';

var udp_matchmaker = dgram.createSocket('udp4');
var udp_port = 6312;

var clients = {} as ServerInfo[];

udp_matchmaker.on('listening', function() {
  const socketInfo = udp_matchmaker.address();
  console.log('# listening [%s:%s]', socketInfo.address, socketInfo.port);
});

udp_matchmaker.on('message', function(data, rinfo) {
  let parsed: TransmittedData;
  try {
    parsed = JSON.parse(data.toString());
  } catch (e) {
    return console.log('! Couldn\'t parse data (%s):\n%s', e, data);
  }
  if (parsed.type == 'register') {
    clients[parsed.name] = {
        name: parsed.name,
        connections: {
          local: parsed.lInfo, 
          public: rinfo
        }
    };
    console.log('# Client registered: %s@[%s:%s | %s:%s]', parsed.name,
                rinfo.address, rinfo.port, parsed.lInfo.address, parsed.lInfo.port);
  } else if (parsed.type == 'connect') {
    var couple = [ clients[parsed.from], clients[parsed.to] ] 
    for (var i=0; i<couple.length; i++) {
      if (!couple[i]) return console.log('Client unknown!');
    }
    
    for (var i=0; i<couple.length; i++) {
      send(couple[i].connections.public.address, couple[i].connections.public.port, {
        type: 'connection',
        client: couple[(i+1)%couple.length],
      }); 
    }
  }
});

var send = function(host, port, msg, cb = undefined) {
  var data = Buffer.from(JSON.stringify(msg));
  udp_matchmaker.send(data, 0, data.length, port, host, function(err, bytes) {
    if (err) {
      udp_matchmaker.close();
      console.log('# stopped due to error: %s', err);
    } else {
      console.log('# sent '+msg.type);
      if (cb) cb();
    }
  });
}

udp_matchmaker.bind(udp_port);
