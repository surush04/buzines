import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { buildCorsOriginChecker, parseExtraOrigins } from '../../config/cors-origins';

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4201';
const isAllowedOrigin = buildCorsOriginChecker(
  frontendUrl,
  parseExtraOrigins(process.env.CORS_ORIGINS),
);

@WebSocketGateway({
  namespace: '/events',
  transports: ['websocket', 'polling'],
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  },
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
