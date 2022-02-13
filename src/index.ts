import { AddressInfo } from "net"

export const enum DataTypes {
  ACK='ack',
  CONNECTION='connection',
  CONNECT='connect',
  PUNCH='punch',
  MESSAGE='message',
  REGISTER='register',
  PING='ping',
  PONG='pong',
  BRUTO='bruto'
}

export type TransmittedData = {
  type: DataTypes
  name: string
  msg: any
  from: string
  to: string
  lInfo: AddressInfo
  rInfo: AddressInfo

  client: {
    connections: any[]
  } & any
}

export type ServerInfo = {
  name: string,
  local: AddressInfo,
  public: AddressInfo
}

export type ClientInfo = {
  ack: boolean
  connection: AddressInfo
}