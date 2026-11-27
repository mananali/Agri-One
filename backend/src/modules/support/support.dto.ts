import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString() @MinLength(4) @MaxLength(160) subject!: string;
  @IsString() @MinLength(10) @MaxLength(3000) message!: string;
}

export class UpdateSupportTicketDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) status!: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  @IsString() @MaxLength(3000) adminReply!: string;
}
