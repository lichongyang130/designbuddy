export interface AgentMessage {from:string;to:string;type:string;payload:unknown}
export class AgentMessageProtocol { encode(msg:AgentMessage){return JSON.stringify(msg);} decode(data:string){return JSON.parse(data) as AgentMessage;} }
