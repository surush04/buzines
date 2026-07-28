import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitToCompany(companyId: string, event: string, data: unknown) {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  emitToEmployee(employeeId: string, event: string, data: unknown) {
    this.server.to(`employee:${employeeId}`).emit(event, data);
  }

  handleJoinCompany(client: Socket, companyId: string) {
    client.join(`company:${companyId}`);
  }

  handleJoinEmployee(client: Socket, employeeId: string) {
    client.join(`employee:${employeeId}`);
  }
}
